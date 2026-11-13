import 'server-only';
import { createClient } from '@/utils/supabase/server';
import { getServiceAdminClient } from './athlete-data-scope';

export async function assignManager(params: { clubId: string; branchId: string; targetUserId?: string; managerEmail?: string; managerName?: string }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: roles, error: roleReadError } = await client.from('user_roles').select('role,club_id').eq('user_id', user.id);
  if (roleReadError || !roles?.some(r => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role) || (['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role) && r.club_id === params.clubId))) throw new Error('Forbidden');
  const admin = getServiceAdminClient();
  const { data: branch, error: branchError } = await admin.from('club_branches').select('id,manager_id').eq('id', params.branchId).eq('club_id', params.clubId).single();
  if (branchError || !branch) throw new Error('Branch does not belong to this club');
  const email = params.managerEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid manager email is required');
  const { data: profile, error: lookupError } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (lookupError) throw new Error('Unable to look up manager');
  let userId = profile?.id;
  let accountCreated = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: 'Password123!', email_confirm: true, user_metadata: { full_name: params.managerName || email, temp_password: true }, app_metadata: { must_change_password: true } });
    if (error || !data.user) throw new Error('Unable to create account. If this email already has an account, use its existing sign-in.');
    userId = data.user.id;
    accountCreated = true;
  }
  try {
    if (typeof (admin as any).rpc === 'function') {
      const rpc = await (admin as any).rpc('assign_branch_manager_atomic', { p_club_id: params.clubId, p_branch_id: params.branchId, p_new_manager_id: userId, p_manager_email: email, p_manager_name: params.managerName || email, p_actor_id: user.id, p_account_created: accountCreated });
      if (!rpc.error) return { userId, accountCreated };
      const missing = rpc.error.code === 'PGRST202' || rpc.error.code === '42883';
      if (!missing) throw rpc.error;
    }
    const { data: existing, error: readError } = await admin.from('user_roles').select('id').eq('user_id', userId).eq('club_id', params.clubId).eq('role', 'BRANCH_MANAGER').maybeSingle();
    if (readError) throw readError;
    const role = { user_id: userId, club_id: params.clubId, branch_id: params.branchId, role: 'BRANCH_MANAGER' };
    const { error } = existing ? await admin.from('user_roles').update(role).eq('id', existing.id) : await admin.from('user_roles').insert(role);
    if (error) throw error;
    const { error: updateError } = await admin.from('club_branches').update({ manager_id: userId }).eq('id', params.branchId).eq('club_id', params.clubId);
    if (updateError) throw updateError;
    if (branch.manager_id && branch.manager_id !== userId) {
      const { error: revokeError } = await admin.from('user_roles').delete().eq('user_id', branch.manager_id).eq('role', 'BRANCH_MANAGER').eq('branch_id', params.branchId).eq('club_id', params.clubId);
      if (revokeError) throw revokeError;
    }
    return { userId, accountCreated };
  } catch (error) {
    if (accountCreated) await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}
