'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function requestClubAccess(clubId: string, requestedRole: string, branchId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Check if request already exists
  const { data: existing } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('status', 'PENDING_APPROVAL')
    .single();

  if (existing) {
    return { error: 'You already have a pending request for this club.' };
  }

  // Insert approval request
  const { error } = await supabase
    .from('approval_requests')
    .insert({
      user_id: user.id,
      club_id: clubId,
      branch_id: branchId || null,
      requested_role: requestedRole,
      status: 'PENDING_APPROVAL'
    });

  if (error) {
    console.error('Error requesting access:', error);
    return { error: 'Failed to request access.' };
  }

  return { success: true };
}

export async function processApprovalRequest(requestId: string, status: 'APPROVED' | 'REJECTED') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  // 1. Fetch the request
  const { data: request, error: reqError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError || !request) return { error: 'Request not found' };

  // 2. Verify admin rights via Server (bypassing RLS temporarily to do complex checks, or relying on RLS)
  // RLS already ensures only superadmins or club_admins for this club can UPDATE the request.
  
  const { error: updateError } = await supabase
    .from('approval_requests')
    .update({ 
      status, 
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('Failed to update request', updateError);
    return { error: 'Unauthorized or failed to update.' };
  }

  // 3. If approved, grant the role
  if (status === 'APPROVED') {
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: request.user_id,
        role: request.requested_role,
        club_id: request.club_id,
        branch_id: request.branch_id
      });

    if (roleError) {
      console.error('Failed to assign role', roleError);
      return { error: 'Request approved but failed to assign role.' };
    }
  }

  revalidatePath('/dashboard/club');
  return { success: true };
}
