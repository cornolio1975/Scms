import { createClient as createSupabaseAdminClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AthleteWorkbookRowData,
  BranchScopeInfo,
  ClubScopeInfo,
  ExistingDbMemberRecord,
  ValidatedAthleteRow,
  WorkbookValidationResult,
  normalizeIdNumber,
  validateAthleteWorkbook,
} from '../excel/athlete-workbook';

export class ScopeAuthorizationError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ScopeAuthorizationError';
    this.status = status;
    this.code = code;
  }
}

export function getServiceAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Server configuration error: Supabase service credentials are not configured.');
  }
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface UserRoleRow {
  role: string;
  club_id: string | null;
  branch_id: string | null;
}

export interface ResolvedOperatorScope {
  userId: string;
  isGlobalAdmin: boolean;
  isClubAdmin: boolean;
  isBranchManagerOnly: boolean;
  targetClub: ClubScopeInfo;
  targetBranch: BranchScopeInfo | null;
  authorizedClubs: Map<string, ClubScopeInfo>;
  clubBranches: Map<string, BranchScopeInfo>; // all branches in targetClub
  authorizedBranches: BranchScopeInfo[]; // branches in targetClub that operator may access
  allBranchesById: Map<string, { id: string; clubId: string; name: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEGACY_CLUB_ID_MAP: Record<string, string> = {
  'scms-club-000001': '11111111-1111-1111-1111-111111111111',
};

const LEGACY_BRANCH_ID_MAP: Record<string, string> = {
  'scms-club-000001-b001': '22222222-2222-2222-2222-222222222222',
  'scms-club-000001-b002': '44444444-4444-4444-4444-444444444444',
  'scms-club-000001-b003': '33333333-3333-3333-3333-333333333333',
};

/**
 * Resolves and strictly validates the caller's club and branch authorization using trusted
 * server-side user_roles records. Never trusts client-supplied role claims.
 */
export async function resolveAuthorizedScope(params: {
  adminClient: SupabaseClient;
  userId: string;
  clubId: string | null | undefined;
  branchId?: string | null | undefined;
}): Promise<ResolvedOperatorScope> {
  const { adminClient, userId, clubId, branchId } = params;

  if (!userId) {
    throw new ScopeAuthorizationError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const rawClubTrimmed = clubId ? clubId.trim() : '';
  const cleanClubId = LEGACY_CLUB_ID_MAP[rawClubTrimmed.toLowerCase()] || rawClubTrimmed;
  if (!cleanClubId || !UUID_REGEX.test(cleanClubId)) {
    throw new ScopeAuthorizationError(
      400,
      'INVALID_CLUB_ID',
      'A valid Club ID (UUID) is required.'
    );
  }

  const rawBranchId = branchId ? branchId.trim() : '';
  const mappedBranchId = LEGACY_BRANCH_ID_MAP[rawBranchId.toLowerCase()] || rawBranchId;
  const cleanBranchId =
    mappedBranchId &&
    mappedBranchId.toUpperCase() !== 'ALL' &&
    mappedBranchId !== '__ALL__'
      ? mappedBranchId
      : null;

  if (cleanBranchId && !UUID_REGEX.test(cleanBranchId)) {
    throw new ScopeAuthorizationError(
      400,
      'INVALID_BRANCH_ID',
      `Invalid Branch ID "${cleanBranchId}".`
    );
  }

  // Load caller's trusted roles from public.user_roles
  const { data: roleRows, error: rolesError } = await adminClient
    .from('user_roles')
    .select('role, club_id, branch_id')
    .eq('user_id', userId);

  if (rolesError) {
    throw new Error(`Failed to verify user roles: ${rolesError.message}`);
  }

  const roles: UserRoleRow[] = (roleRows || []) as UserRoleRow[];
  const isGlobalAdmin = roles.some((r) =>
    ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role)
  );

  // Load clubs and branches
  const [{ data: allClubs, error: clubsErr }, { data: allBranches, error: branchesErr }] =
    await Promise.all([
      adminClient
        .from('clubs')
        .select('id, name, short_name, display_name, primary_admin_id, status'),
      adminClient
        .from('club_branches')
        .select('id, club_id, name, display_name, status'),
    ]);

  if (clubsErr) {
    throw new Error(`Failed to load clubs: ${clubsErr.message}`);
  }
  if (branchesErr) {
    throw new Error(`Failed to load branches: ${branchesErr.message}`);
  }

  const clubsList = allClubs || [];
  const branchesList = allBranches || [];

  const targetClubRow = clubsList.find(
    (c) => c.id.toLowerCase() === cleanClubId.toLowerCase()
  );
  if (!targetClubRow) {
    throw new ScopeAuthorizationError(
      404,
      'CLUB_NOT_FOUND',
      'The requested club does not exist.'
    );
  }

  const isClubAdmin =
    isGlobalAdmin ||
    targetClubRow.primary_admin_id === userId ||
    roles.some(
      (r) =>
        ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role) &&
        r.club_id &&
        r.club_id.toLowerCase() === targetClubRow.id.toLowerCase()
    );

  const managerBranchIdsForClub = new Set<string>(
    roles
      .filter(
        (r) =>
          ['BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(r.role) &&
          r.club_id &&
          r.club_id.toLowerCase() === targetClubRow.id.toLowerCase() &&
          Boolean(r.branch_id)
      )
      .map((r) => (r.branch_id as string).toLowerCase())
  );

  // Also check if a BRANCH_MANAGER role has branch_id set without club_id populated on the role row
  for (const r of roles) {
    if (['BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(r.role) && r.branch_id) {
      const bRow = branchesList.find(
        (b) => b.id.toLowerCase() === r.branch_id!.toLowerCase()
      );
      if (bRow && bRow.club_id && bRow.club_id.toLowerCase() === targetClubRow.id.toLowerCase()) {
        managerBranchIdsForClub.add(bRow.id.toLowerCase());
      }
    }
  }

  const isBranchManagerOnly = !isGlobalAdmin && !isClubAdmin && managerBranchIdsForClub.size > 0;

  if (!isGlobalAdmin && !isClubAdmin && managerBranchIdsForClub.size === 0) {
    throw new ScopeAuthorizationError(
      403,
      'UNAUTHORIZED_CLUB_ACCESS',
      'Forbidden: You do not have administrative permission for this club.'
    );
  }

  // Build map of all branches across all clubs (to detect cross-club branch IDs)
  const allBranchesById = new Map<string, { id: string; clubId: string; name: string }>();
  const clubBranches = new Map<string, BranchScopeInfo>();

  for (const b of branchesList) {
    if (!b.club_id) continue;
    allBranchesById.set(b.id.toLowerCase(), {
      id: b.id,
      clubId: b.club_id,
      name: b.name,
    });
    if (b.club_id.toLowerCase() === targetClubRow.id.toLowerCase()) {
      const info: BranchScopeInfo = {
        id: b.id,
        clubId: b.club_id,
        name: b.name,
        displayName: b.display_name,
      };
      clubBranches.set(b.id, info);
    }
  }

  // Validate requested branchId if supplied
  let targetBranch: BranchScopeInfo | null = null;
  if (cleanBranchId) {
    const lowerBranchId = cleanBranchId.toLowerCase();
    const globalBranch = allBranchesById.get(lowerBranchId);
    if (!globalBranch) {
      throw new ScopeAuthorizationError(
        404,
        'BRANCH_NOT_FOUND',
        'The specified branch does not exist.'
      );
    }
    if (globalBranch.clubId.toLowerCase() !== targetClubRow.id.toLowerCase()) {
      throw new ScopeAuthorizationError(
        403,
        'BRANCH_BELONGS_TO_OTHER_CLUB',
        'Forbidden: The specified branch belongs to another club.'
      );
    }
    if (isBranchManagerOnly && !managerBranchIdsForClub.has(lowerBranchId)) {
      throw new ScopeAuthorizationError(
        403,
        'UNAUTHORIZED_BRANCH_ACCESS',
        'Forbidden: Branch managers can only access their assigned branch.'
      );
    }
    targetBranch = clubBranches.get(globalBranch.id) || {
      id: globalBranch.id,
      clubId: globalBranch.clubId,
      name: globalBranch.name,
    };
  } else if (isBranchManagerOnly) {
    // CRITICAL: A branch manager must never read or update another branch's or club-level athletes when branchId is omitted or blank!
    throw new ScopeAuthorizationError(
      403,
      'BRANCH_SCOPE_REQUIRED',
      'Forbidden: Branch managers must specify their assigned branch ID and cannot access club-wide records.'
    );
  }

  // Build authorizedClubs map
  const authorizedClubs = new Map<string, ClubScopeInfo>();
  for (const c of clubsList) {
    const canAccessClub =
      isGlobalAdmin ||
      c.primary_admin_id === userId ||
      roles.some(
        (r) =>
          ['CLUB_ADMIN', 'CLUB_CO_ADMIN', 'BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(
            r.role
          ) &&
          r.club_id &&
          r.club_id.toLowerCase() === c.id.toLowerCase()
      );
    if (canAccessClub) {
      authorizedClubs.set(c.id.toLowerCase(), {
        id: c.id,
        name: c.name,
        shortName: c.short_name,
        displayName: c.display_name,
      });
    }
  }

  const authorizedBranches = Array.from(clubBranches.values()).filter(
    (b) => !isBranchManagerOnly || managerBranchIdsForClub.has(b.id.toLowerCase())
  );

  const targetClub: ClubScopeInfo = {
    id: targetClubRow.id,
    name: targetClubRow.name,
    shortName: targetClubRow.short_name,
    displayName: targetClubRow.display_name,
  };

  return {
    userId,
    isGlobalAdmin,
    isClubAdmin,
    isBranchManagerOnly,
    targetClub,
    targetBranch,
    authorizedClubs,
    clubBranches,
    authorizedBranches,
    allBranchesById,
  };
}

/**
 * Fetches all members for a club (or branch) using pagination so exports and validations
 * are never truncated by PostgREST's default 1,000-row response limit.
 */
export async function fetchAllScopedMembers(params: {
  adminClient: SupabaseClient;
  clubId: string;
  branchId?: string | null;
  statusFilter?: string | null;
  searchQuery?: string | null;
  pageSize?: number;
}): Promise<ExistingDbMemberRecord[]> {
  const {
    adminClient,
    clubId,
    branchId,
    statusFilter,
    searchQuery,
    pageSize = 500,
  } = params;

  const allRecords: ExistingDbMemberRecord[] = [];
  let offset = 0;

  while (true) {
    let query = adminClient
      .from('members')
      .select(
        'id, member_no, club_id, branch_id, profile_id, full_name, gender, date_of_birth, id_type, ic_passport, nationality, email, phone, address_line_1, address_line_2, postcode, city, state, country, guardian_name, guardian_phone, status, notes, medical_notes, sport_data, emergency_contact, updated_at'
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
      if (statusFilter.toUpperCase() === 'ACTIVE') {
        query = query.in('status', ['Active', 'ACTIVE', 'active']);
      } else if (statusFilter.toUpperCase() === 'INACTIVE') {
        query = query.in('status', ['Inactive', 'INACTIVE', 'inactive', 'Suspended', 'SUSPENDED']);
      }
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().replace(/[,%()]/g, '');
      if (q) {
        query = query.or(
          `full_name.ilike.%${q}%,ic_passport.ilike.%${q}%,member_no.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    const batch = (data || []) as ExistingDbMemberRecord[];
    allRecords.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return allRecords;
}

export interface BulkImportCommitResult {
  success: boolean;
  jobId: string;
  idempotentReplay: boolean;
  destination: {
    clubId: string;
    clubName: string;
    branchId: string | null;
    branchName: string | null;
  };
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  affectedMemberIds: string[];
  errors: Array<{ rowNumber: number; field: string; code: string; message: string }>;
}

/**
 * Validates and optionally commits a bulk athlete workbook import.
 * In 'preview' mode, performs zero database writes.
 * In 'commit' mode, re-validates on the server, checks idempotency, applies creates/updates
 * safely while preserving existing sport_data and lifecycle fields, and writes audit logs.
 */
export async function processAthleteWorkbookImport(params: {
  adminClient: SupabaseClient;
  scope: ResolvedOperatorScope;
  fileBuffer: Buffer;
  fileName: string;
  mode: 'preview' | 'commit';
  allowPartial?: boolean;
  idempotencyKey?: string | null;
  referenceDate?: Date;
}): Promise<{
  validation: WorkbookValidationResult;
  commitResult?: BulkImportCommitResult;
}> {
  const {
    adminClient,
    scope,
    fileBuffer,
    fileName,
    mode,
    allowPartial = false,
    idempotencyKey,
    referenceDate,
  } = params;

  // Fetch all existing members in the target club for validation and duplicate/concurrency checks
  const existingClubMembers = await fetchAllScopedMembers({
    adminClient,
    clubId: scope.targetClub.id,
  });

  // Also check if any athlete_id in the workbook belongs to another club
  const { data: allMemberIds } = await adminClient
    .from('members')
    .select('id, club_id, branch_id');

  const existingMembersByIdGlobal = new Map<
    string,
    { id: string; club_id: string; branch_id: string | null }
  >();
  for (const m of allMemberIds || []) {
    existingMembersByIdGlobal.set(m.id.toLowerCase(), m);
  }

  const validation = validateAthleteWorkbook(fileBuffer, {
    targetClub: scope.targetClub,
    targetBranch: scope.targetBranch,
    requireBranchScope: Boolean(scope.targetBranch) || scope.isBranchManagerOnly,
    authorizedClubs: scope.authorizedClubs,
    clubBranches: scope.clubBranches,
    allBranchesById: scope.allBranchesById,
    existingClubMembers,
    existingMembersByIdGlobal,
    referenceDate,
  });

  if (mode === 'preview') {
    return { validation };
  }

  // COMMIT MODE
  // 1. Check idempotency key so retries / double-clicks never duplicate records
  const cleanIdempotencyKey = idempotencyKey ? idempotencyKey.trim() : null;
  if (cleanIdempotencyKey) {
    const { data: existingJob } = await adminClient
      .from('csv_history')
      .select('id, summary, created_records, updated_records, unchanged_records, error_records, total_records, affected_member_ids, status')
      .eq('idempotency_key', cleanIdempotencyKey)
      .maybeSingle();

    if (existingJob && existingJob.status !== 'FAILED') {
      const savedSummary = (existingJob.summary || {}) as Record<string, unknown>;
      return {
        validation,
        commitResult: {
          success: true,
          jobId: existingJob.id,
          idempotentReplay: true,
          destination: validation.destination,
          totalRows: existingJob.total_records || validation.totalRows,
          createdCount: existingJob.created_records || 0,
          updatedCount: existingJob.updated_records || 0,
          unchangedCount: existingJob.unchanged_records || 0,
          failedCount: existingJob.error_records || 0,
          affectedMemberIds: Array.isArray(existingJob.affected_member_ids)
            ? (existingJob.affected_member_ids as string[])
            : [],
          errors: Array.isArray(savedSummary.errors)
            ? (savedSummary.errors as Array<{
                rowNumber: number;
                field: string;
                code: string;
                message: string;
              }>)
            : [],
        },
      };
    }
  }

  const allErrors = [...validation.workbookErrors, ...validation.rowErrors];

  // Block invalid imports by default unless allowPartial is explicitly enabled and there are no workbook-level errors
  if (validation.workbookErrors.length > 0 || (!validation.valid && !allowPartial)) {
    return {
      validation,
      commitResult: {
        success: false,
        jobId: '',
        idempotentReplay: false,
        destination: validation.destination,
        totalRows: validation.totalRows,
        createdCount: 0,
        updatedCount: 0,
        unchangedCount: validation.unchangedCount,
        failedCount: validation.errorCount,
        affectedMemberIds: [],
        errors: allErrors,
      },
    };
  }

  const existingById = new Map<string, ExistingDbMemberRecord>();
  for (const m of existingClubMembers) {
    existingById.set(m.id.toLowerCase(), m);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = validation.workbookErrors.length;
  const commitErrors: Array<{ rowNumber: number; field: string; code: string; message: string }> = [
    ...validation.workbookErrors,
  ];
  const affectedMemberIds: string[] = [];

  // Determine starting member number sequence for new athletes in this club
  const clubPrefix = (scope.targetClub.shortName || scope.targetClub.name || 'SCMS')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'SCMS';

  let seqCounter = existingClubMembers.length + 1001 + Math.floor(Date.now() % 10000);

  for (const row of validation.rows) {
    if (row.action === 'ERROR') {
      failedCount++;
      commitErrors.push(...row.errors);
      continue;
    }

    if (row.action === 'UNCHANGED') {
      unchangedCount++;
      if (row.existingMemberId) {
        affectedMemberIds.push(row.existingMemberId);
      }
      continue;
    }

    const d: AthleteWorkbookRowData = row.data;
    const nowIso = new Date().toISOString();

    if (row.action === 'CREATE') {
      seqCounter++;
      const memberNo = `${clubPrefix}-${seqCounter}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;

      const sportData: Record<string, unknown> = {
        preferredDiscipline: 'Kumite',
      };
      if (d.belt_rank) {
        sportData.beltRank = d.belt_rank;
        sportData.rankName = d.belt_rank;
      }
      if (d.weight_kg !== null) {
        sportData.weightKg = d.weight_kg;
      }
      if (d.height_cm !== null) {
        sportData.heightCm = d.height_cm;
      }

      const emergencyContact: Record<string, unknown> = {
        name: d.emergency_contact_name || d.guardian_name || null,
        phone: d.emergency_contact_phone || d.guardian_phone || null,
        relationship: d.emergency_contact_name ? 'Emergency Contact' : d.guardian_name ? 'Parent/Guardian' : null,
      };

      const insertPayload = {
        member_no: memberNo,
        club_id: scope.targetClub.id,
        branch_id: d.branch_id || null,
        profile_id: null, // Never create Auth accounts during athlete import
        full_name: d.full_name,
        gender: d.gender,
        date_of_birth: d.date_of_birth || null,
        id_type: d.id_type,
        ic_passport: d.id_number,
        nationality: d.nationality || null,
        email: d.email || null,
        phone: d.phone || null,
        address_line_1: d.address_line_1 || null,
        address_line_2: d.address_line_2 || null,
        postcode: d.postcode || null,
        city: d.city || null,
        state: d.state || null,
        country: d.country || null,
        guardian_name: d.guardian_name || null,
        guardian_phone: d.guardian_phone || null,
        status: d.status,
        notes: d.notes || null,
        medical_notes: d.notes || null,
        sport_data: sportData,
        emergency_contact: emergencyContact,
        joined_date: nowIso.slice(0, 10),
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: inserted, error: insertErr } = await adminClient
        .from('members')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertErr || !inserted) {
        failedCount++;
        const isUniqueViolation =
          insertErr?.code === '23505' ||
          (insertErr?.message && insertErr.message.includes('idx_members_club_ic_passport_unique'));
        commitErrors.push({
          rowNumber: row.rowNumber,
          field: isUniqueViolation ? 'id_number' : 'row',
          code: isUniqueViolation ? 'DUPLICATE_ID_NUMBER_IN_DB' : 'DATABASE_INSERT_ERROR',
          message: isUniqueViolation
            ? `Concurrent duplicate detected: An athlete with identification number exists in this club.`
            : `Failed to insert athlete on row ${row.rowNumber}: ${insertErr?.message || 'Unknown error'}`,
        });
        continue;
      }

      // Insert MEMBER and ATHLETE roles into member_roles
      await adminClient.from('member_roles').insert([
        {
          member_id: inserted.id,
          role: 'MEMBER',
          club_id: scope.targetClub.id,
          branch_id: d.branch_id || null,
          granted_by: scope.userId,
        },
        {
          member_id: inserted.id,
          role: 'ATHLETE',
          club_id: scope.targetClub.id,
          branch_id: d.branch_id || null,
          granted_by: scope.userId,
        },
      ]);

      createdCount++;
      affectedMemberIds.push(inserted.id);
    } else if (row.action === 'UPDATE' && row.existingMemberId) {
      const existing = existingById.get(row.existingMemberId.toLowerCase());
      if (!existing) {
        failedCount++;
        commitErrors.push({
          rowNumber: row.rowNumber,
          field: 'athlete_id',
          code: 'ATHLETE_NOT_FOUND',
          message: `Existing athlete record was not found during commit.`,
        });
        continue;
      }

      // Preserve all unrelated sport_data and emergency_contact keys
      const preservedSportData: Record<string, unknown> = {
        ...(existing.sport_data || {}),
      };
      if (d.belt_rank !== '') {
        preservedSportData.beltRank = d.belt_rank;
        if ('rankName' in preservedSportData) {
          preservedSportData.rankName = d.belt_rank;
        }
      } else {
        delete preservedSportData.beltRank;
      }
      if (d.weight_kg !== null) {
        preservedSportData.weightKg = d.weight_kg;
      } else {
        delete preservedSportData.weightKg;
      }
      if (d.height_cm !== null) {
        preservedSportData.heightCm = d.height_cm;
      } else {
        delete preservedSportData.heightCm;
      }

      const preservedEmergencyContact: Record<string, unknown> = {
        ...(existing.emergency_contact || {}),
        name: d.emergency_contact_name || null,
        phone: d.emergency_contact_phone || null,
      };

      const updatePayload = {
        full_name: d.full_name,
        gender: d.gender,
        date_of_birth: d.date_of_birth || null,
        id_type: d.id_type,
        ic_passport: d.id_number,
        nationality: d.nationality || null,
        email: d.email || null,
        phone: d.phone || null,
        address_line_1: d.address_line_1 || null,
        address_line_2: d.address_line_2 || null,
        postcode: d.postcode || null,
        city: d.city || null,
        state: d.state || null,
        country: d.country || null,
        guardian_name: d.guardian_name || null,
        guardian_phone: d.guardian_phone || null,
        status: d.status,
        notes: d.notes || null,
        medical_notes: d.notes || existing.medical_notes || null,
        sport_data: preservedSportData,
        emergency_contact: preservedEmergencyContact,
        updated_at: nowIso,
      };

      // Optimistic concurrency guard on DB update
      let updateQuery = adminClient
        .from('members')
        .update(updatePayload)
        .eq('id', existing.id)
        .eq('club_id', scope.targetClub.id);

      if (d.updated_at) {
        updateQuery = updateQuery.eq('updated_at', existing.updated_at);
      }

      const { data: updatedRows, error: updateErr } = await updateQuery.select('id');

      if (updateErr) {
        failedCount++;
        commitErrors.push({
          rowNumber: row.rowNumber,
          field: 'row',
          code: 'DATABASE_UPDATE_ERROR',
          message: `Failed to update athlete on row ${row.rowNumber}: ${updateErr.message}`,
        });
        continue;
      }

      if (!updatedRows || updatedRows.length === 0) {
        failedCount++;
        commitErrors.push({
          rowNumber: row.rowNumber,
          field: 'updated_at',
          code: 'STALE_UPDATE_CONFLICT',
          message: `Concurrency conflict on row ${row.rowNumber}: Record was modified by another request.`,
        });
        continue;
      }

      // If this member already has an approved KarateTech participant link, mark it PENDING_SYNC so existing sync jobs pick it up without writing directly to KarateTech
      await adminClient
        .from('scms_karatetech_participant_links')
        .update({
          sync_status: 'PENDING_SYNC',
          updated_at: nowIso,
        })
        .eq('scms_member_id', existing.id)
        .eq('club_id', scope.targetClub.id);

      updatedCount++;
      affectedMemberIds.push(existing.id);
    }
  }

  const jobStatus =
    failedCount === 0
      ? 'COMPLETED'
      : createdCount + updatedCount > 0
      ? 'PARTIAL'
      : 'FAILED';

  // Record audit entry in csv_history (without storing raw IC numbers or personal details in error logs)
  const sanitizedErrorSummary = commitErrors.slice(0, 100).map((e) => ({
    rowNumber: e.rowNumber,
    field: e.field,
    code: e.code,
    message: e.message.replace(/\b\d{6}-?\d{2}-?\d{4}\b/g, '[REDACTED-ID]'),
  }));

  const { data: historyRow } = await adminClient
    .from('csv_history')
    .insert({
      operation: 'IMPORT',
      module_name: 'ATHLETES_XLSX',
      user_id: scope.userId,
      club_id: scope.targetClub.id,
      branch_id: scope.targetBranch ? scope.targetBranch.id : null,
      filename: fileName || 'athletes_import.xlsx',
      idempotency_key: cleanIdempotencyKey,
      total_records: validation.totalRows,
      successful_records: createdCount + updatedCount + unchangedCount,
      created_records: createdCount,
      updated_records: updatedCount,
      unchanged_records: unchangedCount,
      error_records: failedCount,
      affected_member_ids: affectedMemberIds,
      status: jobStatus,
      summary: {
        destination: validation.destination,
        allowPartial,
        errors: sanitizedErrorSummary,
      },
    })
    .select('id')
    .maybeSingle();

  const jobId = historyRow?.id || `job-${Date.now()}`;

  // Also record in audit_logs (no PII)
  await adminClient.from('audit_logs').insert({
    user_id: scope.userId,
    club_id: scope.targetClub.id,
    branch_id: scope.targetBranch ? scope.targetBranch.id : null,
    action: 'BULK_ATHLETE_IMPORT',
    entity_type: 'members',
    entity_id: jobId,
    changes: {
      jobId,
      fileName: fileName || 'athletes_import.xlsx',
      status: jobStatus,
      totalRows: validation.totalRows,
      createdCount,
      updatedCount,
      unchangedCount,
      failedCount,
      affectedRecordCount: affectedMemberIds.length,
      affectedRecordIds: affectedMemberIds.slice(0, 200),
    },
  });

  return {
    validation,
    commitResult: {
      success: failedCount === 0 || (allowPartial && createdCount + updatedCount > 0),
      jobId,
      idempotentReplay: false,
      destination: validation.destination,
      totalRows: validation.totalRows,
      createdCount,
      updatedCount,
      unchangedCount,
      failedCount,
      affectedMemberIds,
      errors: commitErrors,
    },
  };
}

