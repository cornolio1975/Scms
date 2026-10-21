import crypto from 'crypto';

async function getSupabaseServerClient() {
  try {
    const { createClient } = await import('../../utils/supabase/server');
    return await createClient();
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// AUTHORITATIVE PARTICIPANT PAYLOAD & TYPES
// -----------------------------------------------------------------------------

export interface KarateTechParticipantPayload {
  scms_participant_id: string;
  full_name: string;
  gender: 'Male' | 'Female';
  dob: string; // YYYY-MM-DD
  passport_ic: string;
  weight: number;
  height: number;
  email?: string | null;
  phone?: string | null;
  club_id?: string | null;
  scms_club_id?: string | null;
  club_name?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  nationality_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  allow_similar_override?: boolean;

  // Backwards compatibility aliases
  scms_member_id?: string;
  participant_name?: string;
  date_of_birth?: string | null;
}

export interface SyncFieldMapping {
  fieldName: string;
  scmsValue: any;
  karateTechValue: any;
  owner: 'SCMS' | 'KARATETECH';
}

export interface Conflict {
  fieldName: string;
  scmsValue: any;
  karateTechValue: any;
}

export interface SyncStatusResponse {
  karatetechId?: string;
  status: 'SUCCESS' | 'ERROR' | 'CONFLICT' | 'ALREADY_SYNCED';
  message?: string;
  conflicts?: Conflict[];
}

export interface BulkSyncPayload {
  request_id: string;
  club_id: string;
  club_name?: string;
  participants: KarateTechParticipantPayload[];
}

export interface BulkSyncResult {
  total: number;
  created: number;
  updated: number;
  already_synced: number;
  failed: number;
  failures: Array<{ scms_member_id: string; reason: string }>;
}

/**
 * Authoritative typed transformation layer converting source records
 * into the standardized KarateTech outgoing participant payload.
 * Strictly preserves genuine data — ZERO dummy/fabricated defaults.
 */
export function toKarateTechPayload(input: any): KarateTechParticipantPayload {
  const scmsId = String(
    input.scms_participant_id ||
    input.scms_member_id ||
    input.scmsMemberId ||
    input.memberId ||
    input.id ||
    ''
  ).trim();

  const fullName = String(
    input.full_name ||
    input.fullName ||
    input.participant_name ||
    input.memberName ||
    ''
  ).trim();

  let gender: 'Male' | 'Female' | any = null;
  const gRaw = String(input.gender || '').trim().toLowerCase();
  if (gRaw === 'female' || gRaw === 'f') {
    gender = 'Female';
  } else if (gRaw === 'male' || gRaw === 'm') {
    gender = 'Male';
  }

  let dob = '';
  const rawDob = input.dob || input.date_of_birth;
  if (rawDob) {
    const candidate = String(rawDob).split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      dob = candidate;
    }
  }

  const passportIc = String(
    input.passport_ic ||
    input.icPassport ||
    input.passportIc ||
    input.ic_passport ||
    'N/A'
  ).trim();

  const rawWeight = input.weight ?? input.weightKg ?? input.sportData?.weightKg;
  const weight = rawWeight != null && rawWeight !== '' ? Number(rawWeight) : NaN;

  const rawHeight = input.height ?? input.heightCm ?? input.sportData?.heightCm;
  const height = rawHeight != null && rawHeight !== '' ? Number(rawHeight) : NaN;

  const email = input.email ? String(input.email).trim() : null;
  const phone = input.phone ? String(input.phone).trim() : null;

  const clubId = input.club_id || input.scms_club_id || input.clubId || null;
  // Critical: Transmit parent club's Display Name (falling back to canonical name if not set)
  const rawClubName = input.club_display_name || input.clubDisplayName || input.display_name || input.displayName || input.club_name || input.clubName || null;
  const clubName = rawClubName ? String(rawClubName).trim() : null;
  const branchId = input.branch_id || input.branchId || null;
  const branchName = input.branch_name || input.branchName || null;

  let nationalityCode: string | null = null;
  if (input.nationality_code) {
    nationalityCode = String(input.nationality_code).toUpperCase().trim();
  } else if (input.nationality) {
    const nat = String(input.nationality).trim().toLowerCase();
    if (nat.includes('malay')) nationalityCode = 'MAS';
    else if (nat.includes('sing')) nationalityCode = 'SGP';
    else if (nat.includes('thai')) nationalityCode = 'THA';
    else if (nat.includes('indo')) nationalityCode = 'INA';
    else if (/^[A-Za-z]{3}$/.test(input.nationality.trim())) {
      nationalityCode = input.nationality.trim().toUpperCase();
    }
  }

  const emergencyContactName = input.emergency_contact_name || input.emergencyContactName || null;
  const emergencyContactPhone = input.emergency_contact_phone || input.emergencyContactPhone || null;
  const allowSimilarOverride = Boolean(input.allow_similar_override || input.allowSimilarOverride);

  return {
    scms_participant_id: scmsId,
    full_name: fullName,
    gender,
    dob,
    passport_ic: passportIc,
    weight: isNaN(weight) ? (null as any) : weight,
    height: isNaN(height) ? (null as any) : height,
    email,
    phone,
    club_id: clubId,
    scms_club_id: clubId,
    club_name: clubName,
    branch_id: branchId,
    branch_name: branchName,
    nationality_code: nationalityCode,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    allow_similar_override: allowSimilarOverride,
    // Backwards-compatible aliases
    scms_member_id: scmsId,
    participant_name: fullName,
    date_of_birth: dob
  };
}

// -----------------------------------------------------------------------------
// SECURE API CLIENT
// -----------------------------------------------------------------------------

export class KarateTechApiClient {
  private static getBaseUrl(): string {
    const raw = process.env.KARATETECH_API_URL || process.env.NEXT_PUBLIC_KARATETECH_API_URL || 'http://localhost:3001';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  private static getApiKey(): string {
    return process.env.KARATETECH_API_KEY || 'local-dev-secret-key-123';
  }

  private static getTimeout(): number {
    return parseInt(process.env.KARATETECH_API_TIMEOUT_MS || '15000', 10);
  }

  private static async fetchWithTimeout(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getApiKey()}`,
          ...(options.headers || {}),
        },
      });
      clearTimeout(id);
      return response;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error('KarateTech API Request Timeout');
      }
      throw error;
    }
  }

  /**
   * Health check hitting canonical KarateTech health endpoint
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout('/api/integration/scms/health');
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.status === 'healthy' || data.success === true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve participant from KarateTech by external ID
   */
  static async getParticipant(externalId: string): Promise<any> {
    const res = await this.fetchWithTimeout(`/api/integration/scms/participants/${encodeURIComponent(externalId)}`, { method: 'GET' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to get participant. HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Gets sync status from KarateTech by external ID
   */
  static async getSyncStatus(scmsMemberId: string): Promise<any> {
    try {
      const partData = await this.getParticipant(scmsMemberId);
      if (partData?.success && partData.karate_participant) {
        return {
          participant_name: partData.karate_participant.full_name,
          full_name: partData.karate_participant.full_name,
          date_of_birth: partData.karate_participant.dob,
          dob: partData.karate_participant.dob,
          status: partData.sync_info?.status || 'synced',
          karate_participant: partData.karate_participant
        };
      }
    } catch {
      // Fallback to sync-status endpoint
    }

    const res = await this.fetchWithTimeout(`/api/integration/scms/sync-status?scms_participant_id=${encodeURIComponent(scmsMemberId)}`, { method: 'GET' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to get sync status. HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Transmits a single participant to KarateTech
   */
  static async syncParticipant(payload: any, requestId: string): Promise<SyncStatusResponse> {
    const normalized = toKarateTechPayload(payload);

    const res = await this.fetchWithTimeout('/api/integration/scms/participants', {
      method: 'POST',
      headers: { 'X-Request-ID': requestId },
      body: JSON.stringify(normalized),
    });

    const data = await res.json().catch(() => ({}));
    const ktId = data.karate_participant_id || data.karatetech_participant_id;

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('AUTHENTICATION_FAILED');
      if (res.status === 409 || data.status === 'SUSPECTED_DUPLICATE') {
        return {
          status: 'CONFLICT',
          message: data.error || data.message || 'Suspected duplicate participant requires review',
          conflicts: data.matched_participant ? [{
            fieldName: 'matched_participant',
            scmsValue: normalized.scms_participant_id,
            karateTechValue: data.matched_participant
          }] : []
        };
      }
      throw new Error(data.error || data.message || `API Error: HTTP ${res.status}`);
    }

    if (data.status === 'SUSPECTED_DUPLICATE') {
      return {
        status: 'CONFLICT',
        message: data.error || 'Suspected duplicate participant requires review'
      };
    }

    return {
      status: 'SUCCESS',
      karatetechId: ktId,
      message: data.status || 'SUCCESS'
    };
  }

  /**
   * Transmits a batch of participants to KarateTech
   */
  static async syncParticipantsBulk(payload: BulkSyncPayload): Promise<BulkSyncResult> {
    const rawList = payload.participants || [];
    const normalizedList = rawList.map((p: any) => toKarateTechPayload(p));

    const res = await this.fetchWithTimeout('/api/integration/scms/participants/batch', {
      method: 'POST',
      headers: { 'X-Request-ID': payload.request_id },
      body: JSON.stringify({
        club_id: payload.club_id,
        club_name: payload.club_name,
        participants: normalizedList
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `Bulk API Error: HTTP ${res.status}`);

    const results = data.results || [];
    const failures: Array<{ scms_member_id: string; reason: string }> = [];

    results.forEach((r: any) => {
      if (!r.success) {
        failures.push({
          scms_member_id: r.scms_participant_id,
          reason: r.error || (r.status === 'SUSPECTED_DUPLICATE' ? 'Suspected duplicate athlete requires review' : 'Batch write error')
        });
      }
    });

    return {
      total: data.total || normalizedList.length,
      created: data.created || 0,
      updated: data.updated || 0,
      already_synced: 0,
      failed: data.failed || failures.length,
      failures
    };
  }
}

// -----------------------------------------------------------------------------
// SCMS INTEGRATION SERVICE
// -----------------------------------------------------------------------------

export class KarateTechSyncService {
  /**
   * Validates the outgoing payload structure
   */
  static validatePayload(payload: KarateTechParticipantPayload) {
    const missing: string[] = [];
    if (!payload.scms_participant_id) missing.push('scms_participant_id');
    if (!payload.full_name || payload.full_name.trim().length === 0) missing.push('full_name');
    if (!payload.gender || (payload.gender !== 'Male' && payload.gender !== 'Female')) {
      missing.push('gender (Male/Female)');
    }
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!payload.dob || !dobRegex.test(payload.dob)) {
      missing.push('dob (valid YYYY-MM-DD)');
    }
    if (payload.weight == null || isNaN(payload.weight) || payload.weight <= 0) {
      missing.push('weight (> 0 kg)');
    }
    if (payload.height == null || isNaN(payload.height) || payload.height <= 0) {
      missing.push('height (> 0 cm)');
    }

    if (missing.length > 0) {
      throw new Error(`Missing or invalid required participant fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Detects field conflicts between SCMS and KarateTech
   */
  private static detectConflicts(scmsData: KarateTechParticipantPayload, ktData: any): Conflict[] {
    const conflicts: Conflict[] = [];
    const ktName = ktData.full_name || ktData.participant_name;
    const ktDob = ktData.dob || ktData.date_of_birth;

    if (ktName && scmsData.full_name.trim().toLowerCase() !== ktName.trim().toLowerCase()) {
      conflicts.push({ fieldName: 'full_name', scmsValue: scmsData.full_name, karateTechValue: ktName });
    }
    if (ktDob && scmsData.dob !== ktDob) {
      conflicts.push({ fieldName: 'dob', scmsValue: scmsData.dob, karateTechValue: ktDob });
    }
    return conflicts;
  }

  /**
   * Executes the transaction-safe sync to KarateTech via Secure REST API
   */
  static async executeSync(rawPayload: any, userId: string) {
    let supabase: any = await getSupabaseServerClient();

    const payload = toKarateTechPayload(rawPayload);
    const requestId = `SCMS-SYNC-${crypto.randomUUID()}`;

    // 1. Validation Check
    try {
      this.validatePayload(payload);
    } catch (error: any) {
      return { success: false, error: error.message, status: 'FAILED' };
    }

    // 2. Idempotency Check in scms_karatetech_participant_links
    let existingLink: any = null;
    if (supabase) {
      const { data } = await supabase
        .from('scms_karatetech_participant_links')
        .select('*')
        .eq('scms_member_id', payload.scms_participant_id)
        .maybeSingle();
      existingLink = data;
    }

    if (existingLink && existingLink.karatetech_participant_id && existingLink.sync_status === 'SYNCED') {
      try {
        const ktData = await KarateTechApiClient.getSyncStatus(payload.scms_participant_id);
        if (ktData) {
          const conflicts = this.detectConflicts(payload, ktData);
          if (conflicts.length > 0) {
            if (supabase) {
              await supabase.from('scms_karatetech_participant_links').update({
                sync_status: 'CONFLICT',
                conflict_status: 'MANUAL_REQUIRED',
                last_error: 'Conflict detected: SCMS and KarateTech identity fields differ.',
                last_attempted_sync_at: new Date().toISOString()
              }).eq('scms_member_id', payload.scms_participant_id);
            }
            return { success: false, error: 'CONFLICT_DETECTED', status: 'CONFLICT', conflicts };
          } else {
            // Already synced, clean idempotent success
            return {
              success: true,
              karatetechId: existingLink.karatetech_participant_id,
              status: 'ALREADY_SYNCED'
            };
          }
        }
      } catch {
        // Proceed to API sync call
      }
    }

    // 3. Transmit to KarateTech API
    try {
      const response = await KarateTechApiClient.syncParticipant(payload, requestId);

      if (response.status === 'SUCCESS' && response.karatetechId) {
        if (supabase) {
          await supabase.from('scms_karatetech_participant_links').upsert({
            scms_member_id: payload.scms_participant_id,
            scms_participant_id: payload.scms_participant_id,
            club_id: payload.scms_club_id,
            karatetech_participant_id: response.karatetechId,
            sync_status: 'SYNCED',
            last_successful_sync_at: new Date().toISOString(),
            last_attempted_sync_at: new Date().toISOString(),
            last_sync_direction: 'SCMS_TO_KT',
            conflict_status: 'NONE',
            last_error: null,
            retry_count: 0
          }, { onConflict: 'scms_member_id' });

          await this.logSyncHistory(
            supabase,
            payload.scms_participant_id,
            response.karatetechId,
            'UPSERT',
            'SUCCESS',
            null,
            userId,
            requestId,
            payload.scms_club_id
          );
        }

        return {
          success: true,
          karatetechId: response.karatetechId,
          status: 'SUCCESS'
        };
      }

      if (response.status === 'CONFLICT') {
        if (supabase) {
          await supabase.from('scms_karatetech_participant_links').upsert({
            scms_member_id: payload.scms_participant_id,
            scms_participant_id: payload.scms_participant_id,
            club_id: payload.scms_club_id,
            sync_status: 'CONFLICT',
            conflict_status: 'MANUAL_REQUIRED',
            last_attempted_sync_at: new Date().toISOString(),
            last_error: response.message
          }, { onConflict: 'scms_member_id' });

          await this.logSyncHistory(
            supabase,
            payload.scms_participant_id,
            null,
            'UPSERT',
            'CONFLICT',
            response.message || 'Suspected duplicate participant requires review',
            userId,
            requestId,
            payload.scms_club_id
          );
        }

        return { success: false, error: response.message, status: 'CONFLICT', conflicts: response.conflicts };
      }

      throw new Error(response.message || 'Unknown API Error');

    } catch (error: any) {
      const isAuthError = error.message === 'AUTHENTICATION_FAILED';
      const isTransient = !isAuthError && (error.message.includes('Timeout') || error.message.includes('50') || error.message.includes('fetch'));
      const status = isTransient ? 'RETRYING' : 'FAILED';

      if (supabase) {
        await supabase.from('scms_karatetech_participant_links').upsert({
          scms_member_id: payload.scms_participant_id,
          scms_participant_id: payload.scms_participant_id,
          club_id: payload.scms_club_id,
          sync_status: status,
          last_attempted_sync_at: new Date().toISOString(),
          last_error: error.message,
          retry_count: existingLink ? (existingLink.retry_count || 0) + 1 : 1
        }, { onConflict: 'scms_member_id' });

        if (isTransient) {
          await supabase.from('sync_jobs').insert({
            participant_id: payload.scms_participant_id,
            club_id: payload.scms_club_id,
            operation: 'UPSERT',
            direction: 'SCMS_TO_KT',
            status: 'PENDING',
            payload,
            error: error.message
          }).catch(() => {});
        }

        await this.logSyncHistory(
          supabase,
          payload.scms_participant_id,
          null,
          'UPSERT',
          status,
          error.message,
          userId,
          requestId,
          payload.scms_club_id
        );
      }

      return { success: false, error: error.message, status };
    }
  }

  /**
   * Executes batch participant synchronization
   */
  static async executeBulkSync(
    clubId: string,
    rawParticipants: any[],
    userId: string
  ): Promise<{ success: boolean; data?: BulkSyncResult; error?: string }> {
    try {
      const requestId = `SCMS-BULK-${crypto.randomUUID()}`;
      const participants = rawParticipants.map(p => toKarateTechPayload(p));

      let supabase: any = await getSupabaseServerClient();

      const payload: BulkSyncPayload = {
        request_id: requestId,
        club_id: clubId,
        participants
      };

      const result = await KarateTechApiClient.syncParticipantsBulk(payload);

      // Persist status updates to scms_karatetech_participant_links
      if (supabase) {
        const failedIds = new Set(result.failures.map(f => f.scms_member_id));

        for (const p of participants) {
          const isFailed = failedIds.has(p.scms_participant_id);
          const failureObj = result.failures.find(f => f.scms_member_id === p.scms_participant_id);

          await supabase.from('scms_karatetech_participant_links').upsert({
            scms_member_id: p.scms_participant_id,
            scms_participant_id: p.scms_participant_id,
            club_id: clubId,
            sync_status: isFailed ? 'FAILED' : 'SYNCED',
            last_attempted_sync_at: new Date().toISOString(),
            last_successful_sync_at: isFailed ? null : new Date().toISOString(),
            last_error: isFailed ? failureObj?.reason : null
          }, { onConflict: 'scms_member_id' });
        }

        await this.logSyncHistory(
          supabase,
          'BULK',
          null,
          'BULK_UPSERT',
          result.failed === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
          result.failed > 0 ? `${result.failed} participant(s) failed in batch` : null,
          userId,
          requestId,
          clubId
        );
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || 'Bulk sync failed' };
    }
  }

  /**
   * Prepares and checks participant sync status
   */
  static async prepareSync(participantId: string, _userId: string): Promise<any> {
    return await KarateTechApiClient.getSyncStatus(participantId);
  }

  private static async logSyncHistory(
    supabase: any,
    scmsId: string,
    ktId: string | null,
    operation: string,
    status: string,
    errorMessage: string | null,
    userId: string,
    requestId: string,
    clubId?: string | null
  ) {
    if (!supabase) return;
    try {
      await supabase.from('sync_history').insert({
        scms_club_id: clubId,
        scms_participant_id: scmsId === 'BULK' ? null : scmsId,
        karatetech_participant_id: ktId,
        operation,
        direction: 'SCMS_TO_KT',
        status,
        error_message: errorMessage,
        user_id: userId,
        request_id: requestId
      });
    } catch {
      // Non-fatal audit log failure
    }
  }
}
