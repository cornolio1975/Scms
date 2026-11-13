import React from 'react';
import WorkspaceView from '@/components/Workspace/WorkspaceView';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardRolePage(props: any) {
  const resolvedParams = await props.params;
  const { role } = resolvedParams;
  const searchParams = await props.searchParams;
  const clubId = searchParams?.club_id;
  const branchId = searchParams?.branch_id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Authoritative Check
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status === 'PENDING') redirect('/pending-approval');
  if (profile.status === 'INACTIVE' || profile.status === 'SUSPENDED') redirect('/account-suspended');

  const LEGACY_CLUB_MAP: Record<string, string> = {
    'Scms-CLUB-000001': '11111111-1111-1111-1111-111111111111',
  };
  const LEGACY_BRANCH_MAP: Record<string, string> = {
    'Scms-CLUB-000001-B001': '22222222-2222-2222-2222-222222222222',
    'Scms-CLUB-000001-B002': '44444444-4444-4444-4444-444444444444',
    'Scms-CLUB-000001-B003': '33333333-3333-3333-3333-333333333333',
  };

  const normalizedClubId = clubId ? (LEGACY_CLUB_MAP[clubId] || clubId) : undefined;
  const normalizedBranchId = branchId ? (LEGACY_BRANCH_MAP[branchId] || branchId) : undefined;

  // Fetch all roles assigned to this user and validate in memory so global roles (club_id=null)
  // and club-wide roles (branch_id=null) are not excluded by strict equality filters.
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role, club_id, branch_id')
    .eq('user_id', user.id);

  const roleMap: Record<string, string[]> = {
    'superadmin': ['SUPERADMIN'],
    'admin': ['SYSTEM_ADMIN'],
    'club': ['CLUB_ADMIN', 'CLUB_CO_ADMIN'],
    'branch': ['BRANCH_MANAGER'],
    'staff': ['STAFF'],
    'trainer': ['COACH'],
    'volunteer': ['VOLUNTEER'],
    'observer': ['OBSERVER'],
    'member': ['MEMBER', 'ATHLETE', 'PARENT'],
    'guest': []
  };

  const allowedDbRoles = roleMap[role] || [];
  let serverRole = 'MEMBER';
  
  if (normalizedClubId?.startsWith('Scms-')) {
    const roleKey = Object.keys(roleMap).find(key => key === role);
    if (roleKey) serverRole = roleMap[roleKey][0] || 'MEMBER';
  } else {
    if (!userRoles || userRoles.length === 0) {
      redirect('/api/auth/route-dispatch');
    }
    
    // Find a matching role from their returned roles
    const matchingRole = userRoles.find(r => {
      if (!allowedDbRoles.includes(r.role)) return false;
      if (['SUPERADMIN', 'SYSTEM_ADMIN', 'OBSERVER'].includes(r.role)) return true;
      if (normalizedClubId && r.club_id && r.club_id !== normalizedClubId) return false;
      if (normalizedBranchId && r.branch_id && r.branch_id !== normalizedBranchId) return false;
      return true;
    });

    if (role !== 'guest' && !matchingRole) {
      redirect('/api/auth/route-dispatch');
    }
    
    serverRole = matchingRole?.role || 'MEMBER';
  }

  // Pass context so client fetches appropriately
  return (
    <WorkspaceView 
      initialModule="dashboard" 
      serverRole={serverRole} 
      clubId={normalizedClubId || undefined}
      branchId={normalizedBranchId || undefined}
    />
  );
}
