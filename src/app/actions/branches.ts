'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createBranchAndAssignManager(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const clubId = formData.get('clubId') as string;
  const name = formData.get('name') as string;
  const venueName = formData.get('venueName') as string;
  const address = formData.get('address') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const operatingHours = formData.get('operatingHours') as string;
  const managerEmail = formData.get('managerEmail') as string;


  if (!clubId || !name) {
    return { error: 'Club ID and Branch Name are required.' };
  }

  // 1. Verify user is CLUB_ADMIN for this club
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .in('role', ['SUPERADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'])
    .single();

  if (!adminRole) {
    return { error: 'Unauthorized: You are not a Club Admin for this club.' };
  }

  // 3. Create the Branch
  const { data: branch, error: branchError } = await supabase
    .from('club_branches')
    .insert({
      club_id: clubId,
      name,
      venue_name: venueName,
      address,
      city,
      state,
      manager_id: null,
      operating_hours: operatingHours,
      status: 'Active'
    })
    .select()
    .single();

  if (branchError) {
    return { error: 'Failed to create branch: ' + branchError.message };
  }

  if (managerEmail) {
    try {
      const { assignManager } = await import('@/lib/server/branch-manager');
      const result = await assignManager({ clubId, branchId: branch.id, managerEmail });
      revalidatePath('/dashboard');
      return { success: true, branch: { ...branch, manager_id: result.userId }, accountCreated: result.accountCreated };
    } catch (error: any) {
      await supabase.from('club_branches').delete().eq('id', branch.id).eq('club_id', clubId);
      return { error: 'Manager assignment failed: ' + error.message };
    }
  }

  revalidatePath('/dashboard');
  return { success: true, branch };
}
