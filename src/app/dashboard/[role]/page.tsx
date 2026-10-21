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

  // We need to verify they have the role they are trying to access, 
  // AND in the context (club_id, branch_id) they requested.
  let query = supabase.from('user_roles').select('role, club_id, branch_id').eq('user_id', user.id);
  
  if (clubId && !clubId.startsWith('Scms-')) query = query.eq('club_id', clubId);
  if (branchId && !branchId.startsWith('Scms-')) query = query.eq('branch_id', branchId);

  const { data: userRoles } = await query;

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
  
  if (clubId?.startsWith('Scms-')) {
    // If it's a mock club, we bypass server-side role validation
    // The client-side AuthContext will enforce role restrictions
    const roleKey = Object.keys(roleMap).find(key => key === role);
    if (roleKey) serverRole = roleMap[roleKey][0] || 'MEMBER';
  } else {
    if (!userRoles || userRoles.length === 0) {
      redirect('/api/auth/route-dispatch');
    }
    
    // Find a matching role from their returned roles
    const matchingRole = userRoles.find(r => allowedDbRoles.includes(r.role));

    if (role !== 'guest' && !matchingRole) {
      // Unauthorized context or role
      redirect('/api/auth/route-dispatch');
    }
    
    serverRole = matchingRole?.role || 'MEMBER';
  }

  // Pass context so client fetches appropriately
  return (
    <WorkspaceView 
      initialModule="dashboard" 
      serverRole={serverRole} 
      clubId={clubId || undefined}
      branchId={branchId || undefined}
    />
  );
}
