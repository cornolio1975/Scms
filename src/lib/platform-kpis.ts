import type { SupabaseClient } from '@supabase/supabase-js';

/** Read persisted totals only. Optional integration tables must not hide core totals. */
export async function readPlatformKpis(db: SupabaseClient) {
  const count = () => ({ count: 'exact' as const, head: true });
  const queries = {
    totalClubs: db.from('clubs').select('id', count()),
    activeClubs: db.from('clubs').select('id', count()).in('status', ['Active', 'ACTIVE']),
    pendingApprovalClubs: db.from('clubs').select('id', count())
      .or('approval_status.in.(PENDING,PENDING_APPROVAL),status.in.("Pending Approval",Submitted,PENDING_APPROVAL)'),
    suspendedClubs: db.from('clubs').select('id', count()).in('status', ['Suspended', 'SUSPENDED']),
    totalBranches: db.from('club_branches').select('id', count())
      .or('status.is.null,status.not.in.(Archived,ARCHIVED)'),
    totalUsers: db.from('profiles').select('id', count()),
    pendingApprovals: db.from('approval_requests').select('id', count()).eq('status', 'PENDING_APPROVAL'),
  };
  const totals = await Promise.all(Object.entries(queries).map(async ([key, query]) => {
    const { count: value, error } = await query;
    if (error || value === null) throw new Error(`Unable to load database metric: ${key}`);
    return [key, value] as const;
  }));
  const integrationQueries = {
    totalSyncedParticipants: db.from('scms_karatetech_participant_links').select('*', count()).eq('sync_status', 'SYNCED'),
    totalConflicts: db.from('scms_karatetech_participant_links').select('*', count()).eq('sync_status', 'CONFLICT'),
    totalSyncErrors: db.from('scms_karatetech_participant_links').select('*', count()).in('sync_status', ['FAILED', 'ERROR']),
    pendingSyncJobs: db.from('sync_jobs').select('id', count()).in('status', ['PENDING', 'PROCESSING']),
  };
  const integration = await Promise.all(Object.entries(integrationQueries).map(async ([key, query]) => {
    try {
      const { count: value, error } = await query;
      return [key, error ? null : value] as const;
    } catch {
      return [key, null] as const;
    }
  }));
  return { ...Object.fromEntries(totals), ...Object.fromEntries(integration) };
}

export type PlatformKpis = Awaited<ReturnType<typeof readPlatformKpis>>;
