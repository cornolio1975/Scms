import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function getDashboardRouteForUser(): Promise<{ route: string; onboardingRequired: boolean }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { route: '/login', onboardingRequired: false };
  }

  // Fetch or automatically initialize user profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    try {
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          status: 'ACTIVE',
          onboarding_completed: false,
        })
        .select('*')
        .single();

      if (!createErr && created) {
        profile = created;
      }
    } catch (e) {
      console.warn('Auto profile initialization warning:', e);
    }
  }

  if (profile?.status === 'PENDING') {
    return { route: '/pending-approval', onboardingRequired: false };
  }
  if (profile?.status === 'INACTIVE' || profile?.status === 'SUSPENDED') {
    return { route: '/account-suspended', onboardingRequired: false };
  }

  const onboardingRequired = profile ? profile.onboarding_completed === false : true;

  // Fetch all active roles for the user from Supabase
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id);

  // Define role priority hierarchy
  const roleHierarchy: string[] = [
    'SUPERADMIN',
    'SYSTEM_ADMIN',
    'CLUB_ADMIN',
    'CLUB_CO_ADMIN',
    'BRANCH_MANAGER',
    'COACH',
    'STAFF',
    'VOLUNTEER',
    'OBSERVER',
    'ATHLETE',
    'PARENT',
    'MEMBER'
  ];

  let activeRole: { role: string; club_id?: string | null; branch_id?: string | null } | null = null;

  if (userRoles && userRoles.length > 0) {
    for (const rType of roleHierarchy) {
      const found = userRoles.find(r => r.role === rType);
      if (found) {
        activeRole = found;
        break;
      }
    }
  }

  // Fallback to Mock Store if no role in Supabase
  if (!activeRole) {
    try {
      const { store } = await import('@/lib/store');
      for (const club of store.getClubs()) {
        const member = store.getMembers(club.id).find((m: any) => m.email?.toLowerCase() === user.email?.toLowerCase());
        const roles = member?.roles;
        if (member && Array.isArray(roles) && roles.length > 0) {
          const matchedRole = roleHierarchy.find(r => roles.includes(r)) || roles[0];
          activeRole = {
            role: matchedRole,
            club_id: club.id,
            branch_id: member.branchId || null,
          };
          break;
        }
      }
    } catch (e) {
      console.warn('Mock store role fallback error:', e);
    }
  }

  // If still no role assigned, default to MEMBER role rather than locking out the user
  if (!activeRole) {
    activeRole = {
      role: 'MEMBER',
      club_id: null,
      branch_id: null,
    };
  }

  // Check club status if club is assigned
  if (activeRole.club_id && !['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole.role)) {
    let isClubActive = false;

    if (activeRole.club_id.startsWith('Scms-')) {
      try {
        const { store } = await import('@/lib/store');
        const mockClub = store.getClubById(activeRole.club_id);
        if (mockClub && (mockClub.status === 'Active' || (mockClub.status as any) === 'APPROVED')) {
          isClubActive = true;
        }
      } catch (e) {
        console.warn('Mock club validation error:', e);
      }
    } else {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('status')
        .eq('id', activeRole.club_id)
        .maybeSingle();

      if (clubData && (clubData.status === 'Active' || clubData.status === 'APPROVED')) {
        isClubActive = true;
      }
    }

    if (!isClubActive && ['CLUB_ADMIN', 'CLUB_CO_ADMIN', 'BRANCH_MANAGER'].includes(activeRole.role)) {
      return { route: '/login?error=club_pending_or_inactive', onboardingRequired: false };
    }
  }

  // Construct destination URL with query parameters
  const params = new URLSearchParams();
  if (activeRole.club_id) params.append('club_id', activeRole.club_id);
  if (activeRole.branch_id) params.append('branch_id', activeRole.branch_id);
  if (onboardingRequired) params.append('onboarding', 'true');

  const queryString = params.toString() ? `?${params.toString()}` : '';

  let destination = '/dashboard/member';

  switch (activeRole.role) {
    case 'SUPERADMIN':
      destination = `/dashboard/superadmin${queryString}`;
      break;
    case 'SYSTEM_ADMIN':
      destination = `/dashboard/admin${queryString}`;
      break;
    case 'CLUB_ADMIN':
    case 'CLUB_CO_ADMIN':
      destination = `/dashboard/club${queryString}`;
      break;
    case 'BRANCH_MANAGER':
      destination = `/dashboard/branch${queryString}`;
      break;
    case 'COACH':
      destination = `/dashboard/trainer${queryString}`;
      break;
    case 'STAFF':
      destination = `/dashboard/staff${queryString}`;
      break;
    case 'VOLUNTEER':
      destination = `/dashboard/volunteer${queryString}`;
      break;
    case 'OBSERVER':
      destination = `/dashboard/observer${queryString}`;
      break;
    case 'ATHLETE':
    case 'PARENT':
    case 'MEMBER':
    default:
      destination = `/dashboard/member${queryString}`;
      break;
  }

  return { route: destination, onboardingRequired };
}

export async function checkAuthAndRoute() {
  const { route } = await getDashboardRouteForUser();
  redirect(route);
}
