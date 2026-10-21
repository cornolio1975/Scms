'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateDisplayName } from '@/lib/validation/club';

/**
 * Updates Club Profile including canonical name and Display Name
 */
export async function updateClubProfileAction(formData: FormData) {
  let user: any = null;
  let supabase: any = null;

  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch {
    // Supabase client error
  }

  const clubId = formData.get('clubId') as string;
  const name = (formData.get('name') as string)?.trim();
  const rawDisplayName = formData.get('displayName') as string;
  const registrationNo = (formData.get('registrationNo') as string)?.trim() || null;
  const establishedYear = formData.get('establishedYear') ? parseInt(formData.get('establishedYear') as string, 10) : null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const district = (formData.get('district') as string)?.trim() || null;
  const city = (formData.get('city') as string)?.trim() || null;
  const state = (formData.get('state') as string)?.trim() || null;
  const postcode = (formData.get('postcode') as string)?.trim() || null;
  const country = (formData.get('country') as string)?.trim() || 'Malaysia';
  const website = (formData.get('website') as string)?.trim() || null;
  const logoUrl = (formData.get('logoUrl') as string)?.trim() || null;
  const description = (formData.get('description') as string)?.trim() || null;

  if (!clubId || !name) {
    return { error: 'Club ID and Club Name are required.' };
  }

  // Validate Display Name
  const displayVal = validateDisplayName(rawDisplayName || name);
  if (!displayVal.valid) {
    return { error: displayVal.error };
  }
  const displayName = displayVal.value;

  // 1. In-memory / Mock Store support
  if (clubId.startsWith('Scms-')) {
    const { store } = await import('@/lib/store');
    const operator = user?.email || 'Authorized Operator';
    try {
      store.updateClub(
        clubId,
        {
          name,
          displayName,
          registrationNo: registrationNo || undefined,
          establishedYear: establishedYear || undefined,
          phone: phone || '',
          email: email || '',
          address: address || '',
          district: district || '',
          city: city || '',
          state: state || '',
          postcode: postcode || '',
          country,
          website: website || undefined,
          logoUrl: logoUrl || undefined,
          description: description || undefined
        },
        operator
      );
      const updated = store.getClubById(clubId);
      return { success: true, club: updated };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  // 2. Supabase Backend
  if (!user || !supabase) {
    return { error: 'Authentication required to update club profile.' };
  }

  // Verify Role & Authorization
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role, club_id')
    .eq('user_id', user.id);

  const isSuperAdmin = userRoles?.some((r: any) => r.role === 'SUPERADMIN' || r.role === 'SYSTEM_ADMIN');
  const isClubAdminForThis = userRoles?.some(
    (r: any) => (r.role === 'CLUB_ADMIN' || r.role === 'CLUB_CO_ADMIN') && r.club_id === clubId
  );
  const isBranchManager = userRoles?.some((r: any) => r.role === 'BRANCH_MANAGER');

  if (!isSuperAdmin && !isClubAdminForThis) {
    if (isBranchManager) {
      return { error: 'Unauthorized: Branch Managers cannot edit the parent club profile or Display Name.' };
    }
    return { error: 'Unauthorized: You do not have permission to edit this club.' };
  }

  // Fetch previous club details for audit logging
  const { data: prevClub } = await supabase
    .from('clubs')
    .select('name, display_name')
    .eq('id', clubId)
    .single();

  const updates: Record<string, any> = {
    name,
    display_name: displayName,
    registration_no: registrationNo,
    established_year: establishedYear,
    phone,
    email,
    address,
    city,
    state,
    postcode,
    country,
    website,
    logo_url: logoUrl,
    description,
    updated_at: new Date().toISOString()
  };

  const { data: updatedClub, error: updateError } = await supabase
    .from('clubs')
    .update(updates)
    .eq('id', clubId)
    .select()
    .single();

  if (updateError) {
    return { error: 'Failed to update club: ' + updateError.message };
  }

  // Audit Logging
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      club_id: clubId,
      action: prevClub?.display_name !== displayName ? 'CLUB_DISPLAY_NAME_UPDATED' : 'CLUB_PROFILE_UPDATED',
      details: {
        name,
        displayName,
        previousDisplayName: prevClub?.display_name || null,
        updatedBy: user.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch {
    // Audit logging failure should not abort update
  }

  revalidatePath('/club-profile');
  return { success: true, club: updatedClub };
}

/**
 * Updates Branch Profile while strictly preserving parent club association
 */
export async function updateBranchProfileAction(formData: FormData) {
  let user: any = null;
  let supabase: any = null;

  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch {
    // Supabase client error
  }

  const branchId = formData.get('branchId') as string;
  const name = (formData.get('name') as string)?.trim();
  const venueName = (formData.get('venueName') as string)?.trim() || 'Dojo Facility';
  const address = (formData.get('address') as string)?.trim() || null;
  const city = (formData.get('city') as string)?.trim() || null;
  const state = (formData.get('state') as string)?.trim() || null;
  const postcode = (formData.get('postcode') as string)?.trim() || null;
  const country = (formData.get('country') as string)?.trim() || 'Malaysia';
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const operatingHours = (formData.get('operatingHours') as string)?.trim() || null;
  const status = (formData.get('status') as string) || 'Active';

  if (!branchId || !name) {
    return { error: 'Branch ID and Branch Name are required.' };
  }

  // 1. In-memory / Mock Store
  if (branchId.startsWith('Scms-') || branchId.includes('-B')) {
    const { store } = await import('@/lib/store');
    const operator = user?.email || 'Authorized Operator';
    try {
      store.updateBranch(
        branchId,
        {
          name,
          venueName,
          address: address || '',
          city: city || '',
          state: state || '',
          postcode: postcode || '',
          country,
          phone: phone || '',
          email: email || '',
          operatingHours: operatingHours || undefined,
          status: status as any
        },
        operator
      );
      const branch = store.getBranches().find((b: any) => b.id === branchId);
      return { success: true, branch };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  // 2. Supabase Backend
  if (!user || !supabase) {
    return { error: 'Authentication required to update branch profile.' };
  }

  // Query existing branch to verify parent club
  const { data: existingBranch, error: fetchErr } = await supabase
    .from('club_branches')
    .select('*, clubs(id, name, display_name)')
    .eq('id', branchId)
    .single();

  if (fetchErr || !existingBranch) {
    return { error: 'Branch not found.' };
  }

  // Verify Role & Authorization
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role, club_id, branch_id')
    .eq('user_id', user.id);

  const isSuperAdmin = userRoles?.some((r: any) => r.role === 'SUPERADMIN' || r.role === 'SYSTEM_ADMIN');
  const isClubAdminForThis = userRoles?.some(
    (r: any) => (r.role === 'CLUB_ADMIN' || r.role === 'CLUB_CO_ADMIN') && r.club_id === existingBranch.club_id
  );
  const isBranchManagerForThis = userRoles?.some(
    (r: any) => r.role === 'BRANCH_MANAGER' && (r.branch_id === branchId || existingBranch.manager_id === user.id)
  );

  if (!isSuperAdmin && !isClubAdminForThis && !isBranchManagerForThis) {
    return { error: 'Unauthorized: You do not have permission to edit this branch.' };
  }

  // Safety invariant: NEVER overwrite club_id
  const branchUpdates = {
    name,
    venue_name: venueName,
    address,
    city,
    state,
    postcode,
    country,
    phone,
    email,
    operating_hours: operatingHours,
    status,
    updated_at: new Date().toISOString()
  };

  const { data: updatedBranch, error: updateErr } = await supabase
    .from('club_branches')
    .update(branchUpdates)
    .eq('id', branchId)
    .select()
    .single();

  if (updateErr) {
    return { error: 'Failed to update branch: ' + updateErr.message };
  }

  // Audit Logging
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      club_id: existingBranch.club_id,
      branch_id: branchId,
      action: 'BRANCH_PROFILE_UPDATED',
      details: {
        branchName: name,
        updatedBy: user.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch {
    // Non-fatal
  }

  revalidatePath('/club-profile');
  return { success: true, branch: updatedBranch };
}
