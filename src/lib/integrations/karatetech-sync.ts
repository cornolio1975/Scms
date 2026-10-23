import { gatewayDb } from "@/lib/payments/admin";
import { createHash } from "node:crypto";
import { session, HttpError } from "@/lib/scms/server";
import { canManage, identityConflicts } from "@/lib/scms/access";
import {buildAthletePayload, participantDifferences, type AthletePayload} from "./athlete-contract";
export type KarateTechParticipantPayload = AthletePayload;
export type Conflict = {
  fieldName: string;
  scmsValue: unknown;
  karateTechValue: unknown;
};
export interface SyncStatusResponse {
  karatetechId?: string;
  status: "SUCCESS" | "ERROR" | "CONFLICT";
  message?: string;
  conflicts?: Conflict[];
  operation?: "created" | "updated" | "unchanged";
}
export interface BulkSyncResult {
  total: number;
  created: number;
  updated: number;
  already_synced: number;
  failed: number;
  failures: Array<{ scms_member_id: string; reason: string }>;
}
export interface BulkSyncPayload {
  request_id: string;
  club_id: string;
  participants: KarateTechParticipantPayload[];
}
export class KarateTechApiClient {
  private static async request(path: string, options: RequestInit = {}) {
    const base = process.env.KARATETECH_API_URL,
      key = process.env.KARATETECH_API_KEY;
    if (!base || !key)
      throw new HttpError(503, "KarateTech connection is not configured");
    const url = new URL(base);
    if (
      url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw Error("A secure KarateTech URL is required");
    const response = await fetch(new URL(path, url), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    });
    return response;
  }
  static async checkHealth() {
    try {
      const r=await this.request("/api/integration/scms/health/");
      if (!r.ok) return false;
      const d=await r.json(); return d.success===true && d.contract_version===1;
    } catch {
      return false;
    }
  }
  static async getSyncStatus(id: string) {
    const r = await this.request(
      "/api/integration/scms/sync-status/?scms_member_id=" +
        encodeURIComponent(id),
    );
    if (r.status === 404) return null;
    if (!r.ok) throw new HttpError(502, "KarateTech status lookup failed");
    const d = await r.json();
    const remote = d.data?.participant || d.participant || d.data || d;
    if (remote?.exists === false) return null;
    if (
      !remote ||
      typeof remote !== "object" ||
      ![remote.participant_name, remote.full_name, remote.name].some(
        (x) => typeof x === "string",
      )
    )
      throw new HttpError(
        502,
        "KarateTech returned an incomplete participant identity; sync has been stopped",
      );
    return remote;
  }
  static async syncParticipant(
    payload: KarateTechParticipantPayload,
    key: string,
  ): Promise<SyncStatusResponse> {
    const r = await this.request("/api/integration/scms/participants/", {
      method: "POST",
      headers: { "X-Request-ID": key, "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 409)
      return {
        status: "CONFLICT",
        message: "KarateTech reports a conflicting participant",
      };
    if (!r.ok)
      throw new HttpError(
        502,
        "KarateTech rejected the participant. Check its integration configuration.",
      );
    const id =
      d.karatetech_participant_id ||
      d.data?.karatetech_participant_id ||
      d.participant_id ||
      d.data?.participant_id;
    if (typeof id !== "string" || !id)
      throw new HttpError(
        502,
        "KarateTech did not return a participant identity",
      );
    return { status: "SUCCESS", karatetechId: id, operation:d.operation };
  }
}
export async function participantPayload(id: string, write = false) {
  const s = await session();
  const { data: m, error } = await s.db
    .from("members")
    .select(
      "id,member_no,club_id,branch_id,full_name,gender,date_of_birth,ic_passport,nationality,email,phone,emergency_contact,status,sport_data,updated_at,clubs(name,display_name)",
    )
    .eq("id", id)
    .single();
  if (error || !m) throw new HttpError(404, "Participant unavailable");
  if (write && !canManage(s.roles, m.club_id, m.branch_id))
    throw new HttpError(403, "Club or branch permission required");
  if (
    !write &&
    !canManage(s.roles, m.club_id, m.branch_id) &&
    !s.roles.some(
      (r) =>
        r.role === "OBSERVER" &&
        (!r.club_id || r.club_id === m.club_id) &&
        (!r.branch_id || r.branch_id === m.branch_id),
    )
  )
    throw new HttpError(403, "Participant access denied");
  if (
    !m.date_of_birth ||
    !["Male", "Female"].includes(m.gender) ||
    !m.full_name?.trim()
  )
    throw new HttpError(
      422,
      "Correct the participant name, DOB and gender before syncing",
    );
  const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
  const {data:athlete,error:athleteError}=await s.db.from("member_roles").select("member_id").eq("member_id",id).eq("role","ATHLETE").maybeSingle();
  if (athleteError) throw new HttpError(503,"Athlete role could not be verified");
  if (!athlete || m.status!=="ACTIVE") throw new HttpError(422,"Only active athletes can be synchronised");
  const payload=buildAthletePayload(m,club || {});
  if (!payload.club_name)
    throw new HttpError(422, "Club display name is required");
  return { ...s, member: m, payload };
}
export class KarateTechSyncService {
  static async prepareSync(id: string, _club?: string) {
    const { db, payload, member } = await participantPayload(id);
    const remote = await KarateTechApiClient.getSyncStatus(id);
    const conflicts = remote ? identityConflicts(payload, remote) : [];
    const { data: link, error } = await db
      .from("scms_karatetech_participant_links")
      .select("*")
      .eq("scms_member_id", id)
      .maybeSingle();
    if (error)
      throw new HttpError(503, "Sync identity mapping could not be read");
    return {
      payload,
      remote,
      link,
      conflicts,
      status: conflicts.length ? "CONFLICT" : link ? "LINKED" : "NEW",
      requiresManualResolution: conflicts.length > 0,
      approved: ["APPROVED", "SYNCED", "ACTIVE"].includes(
        member.sport_data?.participantStatus,
      ),
    };
  }
  static async executeSync(
    supplied: KarateTechParticipantPayload,
    _userId?: string,
  ) {
    const { user, payload, member } = await participantPayload(
      supplied.scms_member_id,
      true,
    );
    if(!["APPROVED","SYNCED","ACTIVE"].includes(member.sport_data?.participantStatus))
      throw new HttpError(422,"Participant approval required");
    const key =
      "SCMS-" +
      createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    async function state(
      status: string,
      kt?: string,
      message?: string,
      conflicts?: Conflict[],
    ) {
      const { error } = await gatewayDb().rpc("scms_sync_state_trusted", {
        p_actor: user.id,
        p_member: payload.scms_member_id,
        p_state: status,
        p_key: key,
        p_kt: kt || null,
        p_message: message || null,
        p_conflicts: conflicts || null,
      });
      if (error)
        throw new HttpError(503, "Sync bookkeeping failed: " + error.message);
    }
    await state("START");
    try {
      const remote = await KarateTechApiClient.getSyncStatus(
        payload.scms_member_id,
      );
      const conflicts = remote ? identityConflicts(payload, remote) : [];
      if (conflicts.length) {
        await state(
          "CONFLICT",
          undefined,
          "Name or DOB conflict requires reconciliation",
          conflicts,
        );
        return {
          success: false,
          error: "Name or date-of-birth conflict",
          conflicts,
        };
      }
      const response = await KarateTechApiClient.syncParticipant(payload, key);
      if (response.status !== "SUCCESS" || !response.karatetechId) {
        await state("CONFLICT", undefined, response.message);
        return { success: false, error: response.message };
      }
      const saved=await KarateTechApiClient.getSyncStatus(payload.scms_member_id);
      const differences=saved ? participantDifferences(payload,saved) : ["participant_missing"];
      if (!saved || saved.karatetech_participant_id!==response.karatetechId || differences.length)
        throw new HttpError(502,"KarateTech read-back did not match: "+differences.join(", "));
      await state("SUCCESS", response.karatetechId);
      return { success: true, karatetechId: response.karatetechId, operation:response.operation };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await state("ERROR", undefined, message);
      return { success: false, error: message };
    }
  }
  static async executeBulkSync(
    clubId: string,
    participants: KarateTechParticipantPayload[],
    _userId?: string,
  ) {
    if (participants.length < 1 || participants.length > 100)
      throw new HttpError(400, "Select between 1 and 100 participants");
    const result: BulkSyncResult = {
      total: new Set(participants.map(p=>p.scms_member_id)).size,
      created: 0,
      updated: 0,
      already_synced: 0,
      failed: 0,
      failures: [],
    };
    for (const id of [...new Set(participants.map((p) => p.scms_member_id))]) {
      try {
        const x = await participantPayload(id, true);
        if (x.payload.scms_club_id !== clubId)
          throw new HttpError(403, "Participant does not belong to this club");
        const r = await this.executeSync(x.payload);
        if (!r.success) throw Error(r.error);
        if(r.operation==="created") result.created++;
        else if(r.operation==="unchanged") result.already_synced++;
        else result.updated++;
      } catch (e) {
        result.failed++;
        result.failures.push({
          scms_member_id: id,
          reason: e instanceof Error ? e.message : "Sync failed",
        });
      }
    }
    return {
      success: result.failed === 0,
      data: result,
      error: result.failed
        ? "Some participants were not synchronised"
        : undefined,
    };
  }
}
