'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addMemberToClub(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const clubId = formData.get('clubId') as string;
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  // Other fields can be processed here if a members table existed.
  // Currently, members are users in `profiles` with a role in `user_roles`.
  // Since we cannot create a full Auth user without their password safely here unless we use Admin API,
  // we will simulate the process by checking if they exist, or returning an instruction.

  if (!clubId || !email) {
    return { error: 'Club ID and Email are required.' };
  }

  // Verify the current user is a Club Admin for this club
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

  // In a real application, you would use Supabase Admin API to create the user,
  // or insert into a dedicated `club_members` table if they don't need login access yet.
  // For the purpose of this architecture rewrite, we will just search for the profile.
  const { data: existingProfile } = await supabase.rpc('find_profile_by_email', { search_email: email });

  let targetUserId = existingProfile?.id;

  if (!targetUserId) {
    return { error: 'User does not exist in the system yet. In a production environment, this would create an account and send an invite email.' };
  }

  // Assign the MEMBER role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: targetUserId,
      role: 'MEMBER',
      club_id: clubId
    });

  if (roleError) {
    return { error: 'Failed to assign member role: ' + roleError.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
