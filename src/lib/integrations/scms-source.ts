import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { toKarateTechPayload, KarateTechSyncService } from './karatetech-sync';

export class IntegrationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function syncContext(clubId: string) {
  if (!clubId) throw new IntegrationError('Select a club first.');
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) throw new IntegrationError('Sign in to continue.', 401);
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : session;
  const { data: roles, error } = await db.from('user_roles').select('role,club_id,branch_id').eq('user_id', user.id);
  if (error) throw new IntegrationError('Unable to verify club permissions.', 503);
  const admin = roles?.some(r => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role));
  const clubManager = roles?.some(r => ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role) && r.club_id === clubId);
  const branches = roles?.filter(r => r.role === 'BRANCH_MANAGER' && r.club_id === clubId && r.branch_id).map(r => r.branch_id) || [];
  if (!admin && !clubManager && !branches.length) throw new IntegrationError('You do not have permission to transfer athletes for this club.', 403);
  const { data: club, error: clubError } = await db.from('clubs').select('id,name,display_name').eq('id', clubId).maybeSingle();
  if (clubError || !club) throw new IntegrationError('Club not found or inaccessible.', 404);
  return { db, user, club, branches: admin || clubManager ? null : branches };
}

export async function sourceMembers(context: Awaited<ReturnType<typeof syncContext>>) {
  let memberQuery = context.db.from('members').select('*').eq('club_id', context.club.id);
  if (context.branches) memberQuery = memberQuery.in('branch_id', context.branches);
  const { data: savedMembers, error: memberError } = await memberQuery;
  // Older installations may not have the members table yet.
  if (memberError && !['42P01', 'PGRST205'].includes(memberError.code)) throw new IntegrationError('Unable to load saved club athletes.', 503);

  let query = context.db.from('user_roles').select('user_id,branch_id').eq('club_id', context.club.id).in('role', ['MEMBER', 'ATHLETE']);
  if (context.branches) query = query.in('branch_id', context.branches);
  const { data: memberships, error } = await query;
  if (error) throw new IntegrationError('Unable to load club athletes.', 503);
  const ids = [...new Set((memberships || []).map(r => r.user_id))];
  let profiles: any[] = [];
  if (ids.length) {
    const result = await context.db.from('profiles').select('*').in('id', ids).order('full_name');
    if (result.error) throw new IntegrationError('Unable to load athlete profiles.', 503);
    profiles = result.data || [];
  }
  const rows: any[] = (savedMembers || []).map((member: any) => ({
    ...member,
    dob: member.date_of_birth || member.dob,
    passport_ic: member.ic_passport || member.passport_ic,
    weight: member.sport_data?.weightKg ?? member.weight,
    height: member.sport_data?.heightCm ?? member.height,
    emergency_contact_name: member.emergency_contact?.name || member.emergency_contact_name,
    emergency_contact_phone: member.emergency_contact?.phone || member.emergency_contact_phone,
  }));
  // Keep the canonical member ID stable; linked Auth profiles are not a second athlete.
  for (const profile of profiles) {
    if (!rows.some(member => member.id === profile.id || member.profile_id === profile.id)) rows.push(profile);
  }
  return rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
}

export function sourcePayload(profile: any, context: Awaited<ReturnType<typeof syncContext>>, details: Record<string, unknown> = {}) {
  // Only identity/measurement details may be supplied; source IDs and club ownership stay server-controlled.
  const allowed = ['gender','dob','passport_ic','weight','height','nationality_code'];
  const supplied = Object.fromEntries(allowed.filter(k => details[k] != null && details[k] !== '').map(k => [k, details[k]]));
  const payload = toKarateTechPayload({ ...profile, ...supplied, scms_participant_id: profile.id, full_name: profile.full_name,
    club_id: context.club.id, scms_club_id: context.club.id, club_name: context.club.display_name || context.club.name });
  try { KarateTechSyncService.validatePayload(payload); } catch (error) {
    throw new IntegrationError(error instanceof Error ? error.message : 'Invalid athlete details.', 422);
  }
  return payload;
}
