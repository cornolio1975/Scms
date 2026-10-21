import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function getDashboardRouteForUser() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return '/login';
  }

  // Fetch user profile and status
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (!profile) return '/login';

  if (profile.status === 'PENDING') return '/pending-approval';
  if (profile.status === 'INACTIVE' || profile.status === 'SUSPENDED') return '/account-suspended';

  // Fetch all active roles for the user
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id);

  // Enforce allowed roles only
  const allowedRoles = ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER'];
  let validRoles = (userRoles || []).filter(r => allowedRoles.includes(r.role));
  let activeRole = validRoles.find(r => r.role === 'SUPERADMIN') 
                || validRoles.find(r => r.role === 'CLUB_ADMIN') 
                || validRoles.find(r => r.role === 'BRANCH_MANAGER');

  // Fallback to Mock Store if no valid roles in Supabase
  if (!activeRole) {
    // We cannot import store in edge runtime/server component easily without dynamic import
    // But since this is a server action/route handler, we can import it.
    try {
      const { store } = await import('@/lib/store');
      // Find member by email across all mock clubs
      for (const club of store.getClubs()) {
        const member = store.getMembers(club.id).find((m: any) => m.email === user.email);
        if (member && member.roles && member.roles.some((r: string) => allowedRoles.includes(r))) {
          const role = member.roles.find((r: string) => allowedRoles.includes(r));
          activeRole = {
            role: role as any,
            club_id: club.id,
            branch_id: member.branchId,
          };
          validRoles = [activeRole];
          break;
        }
      }
    } catch (e) {
      console.error('Mock store fallback failed', e);
    }
  }

  if (!activeRole) {
    await supabase.auth.signOut();
    return '/login?error=unauthorized_role';
  }

  if (activeRole.role === 'CLUB_ADMIN' || activeRole.role === 'BRANCH_MANAGER') {
    if (!activeRole.club_id) {
      await supabase.auth.signOut();
      return '/login?error=no_club_assigned';
    }
    
    let isClubActive = false;
    
    if (activeRole.club_id.startsWith('Scms-')) {
      try {
        const { store } = await import('@/lib/store');
        const mockClub = store.getClubById(activeRole.club_id);
        if (mockClub && (mockClub.status === 'Active' || mockClub.status === 'APPROVED' as any)) {
          isClubActive = true;
        }
      } catch (e) { console.error('Mock club error', e); }
    } else {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('status')
        .eq('id', activeRole.club_id)
        .single();
      if (clubData && (clubData.status === 'Active' || clubData.status === 'APPROVED' as any)) {
        isClubActive = true;
      }
    }

    if (!isClubActive) {
      await supabase.auth.signOut();
      return '/login?error=club_pending_or_inactive';
    }
  }

  // Route-based routing with context params
  let params = new URLSearchParams();
  if (activeRole.club_id) params.append('club_id', activeRole.club_id);
  if (activeRole.branch_id) params.append('branch_id', activeRole.branch_id);
  
  const queryString = params.toString() ? `?${params.toString()}` : '';

  switch (activeRole.role) {
    case 'SUPERADMIN': return '/dashboard/superadmin';
    case 'CLUB_ADMIN': return `/dashboard/club${queryString}`;
    case 'BRANCH_MANAGER': return `/dashboard/branch${queryString}`;
    default: 
      await supabase.auth.signOut();
      return '/login?error=unauthorized_role';
  }
}

export async function checkAuthAndRoute() {
  const route = await getDashboardRouteForUser();
  redirect(route);
}
