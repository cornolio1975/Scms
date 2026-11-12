'use server';
import { createClient } from '@/utils/supabase/server';
import { getServiceAdminClient, resolveAuthorizedScope } from '@/lib/server/athlete-data-scope';

export async function getBranchDashboard(clubId: string, branchId: string) {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const admin = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({ adminClient: admin, userId: user.id, clubId, branchId });
    const { count, error } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('club_id', scope.targetClub.id).eq('branch_id', scope.targetBranch!.id);
    if (error) throw error;
    return { success: true, branchName: scope.targetBranch!.name, memberCount: count || 0 };
  } catch {
    return { success: false, error: 'Unable to load your assigned branch dashboard.' };
  }
}
