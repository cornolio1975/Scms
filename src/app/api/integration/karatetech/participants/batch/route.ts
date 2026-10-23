import { body, HttpError, responseError } from "@/lib/scms/server";
import {
  participantPayload,
  KarateTechSyncService,
} from "@/lib/integrations/karatetech-sync";
export async function POST(req: Request) {
  try {
    const { clubId, memberIds } = await body(req);
    if (
      typeof clubId !== "string" ||
      !Array.isArray(memberIds) ||
      memberIds.length < 1 ||
      memberIds.length > 100 ||
      memberIds.some((i) => typeof i !== "string")
    )
      throw new HttpError(
        400,
        "Club and between 1 and 100 participant IDs required",
      );
    const payloads = [];
    for (const id of [...new Set(memberIds)] as string[]) {
      const { payload } = await participantPayload(id, true);
      if (payload.scms_club_id !== clubId)
        throw new HttpError(403, "Participant club mismatch");
      payloads.push(payload);
    }
    const r = await KarateTechSyncService.executeBulkSync(clubId, payloads);
    return Response.json(r, { status: r.success ? 200 : 207 });
  } catch (e) {
    return responseError(e);
  }
}
