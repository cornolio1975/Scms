'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function SelectContextPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [branches, setBranches] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadRoles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (!userRoles || userRoles.length === 0) {
        router.push('/dashboard/unassigned');
        return;
      }

      setRoles(userRoles);

      // Fetch related clubs
      const clubIds = [...new Set(userRoles.map(r => r.club_id).filter(Boolean))];
      if (clubIds.length > 0) {
        const { data: clubsData } = await supabase.from('clubs').select('*').in('id', clubIds);
        if (clubsData) {
          const clubMap = clubsData.reduce((acc, club) => ({ ...acc, [club.id]: club }), {});
          setClubs(clubMap);
        }
      }

      // Fetch related branches
      const branchIds = [...new Set(userRoles.map(r => r.branch_id).filter(Boolean))];
      if (branchIds.length > 0) {
        const { data: branchesData } = await supabase.from('club_branches').select('*').in('id', branchIds);
        if (branchesData) {
          const branchMap = branchesData.reduce((acc, branch) => ({ ...acc, [branch.id]: branch }), {});
          setBranches(branchMap);
        }
      }

      setLoading(false);
    }
    loadRoles();
  }, [router, supabase]);

  const handleSelect = (roleEntry: any) => {
    let params = new URLSearchParams();
    if (roleEntry.club_id) params.append('club_id', roleEntry.club_id);
    if (roleEntry.branch_id) params.append('branch_id', roleEntry.branch_id);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';

    switch (roleEntry.role) {
      case 'SUPERADMIN': router.push(`/dashboard/superadmin`); break;
      case 'CLUB_ADMIN': router.push(`/dashboard/club${queryString}`); break;
      case 'BRANCH_MANAGER': router.push(`/dashboard/branch${queryString}`); break;
      case 'STAFF': router.push(`/dashboard/staff${queryString}`); break;
      case 'COACH': router.push(`/dashboard/trainer${queryString}`); break;
      case 'VOLUNTEER': router.push(`/dashboard/volunteer${queryString}`); break;
      case 'OBSERVER': router.push(`/dashboard/observer${queryString}`); break;
      case 'MEMBER':
      case 'ATHLETE':
      case 'PARENT':
        router.push(`/dashboard/member${queryString}`); break;
      default: router.push(`/dashboard/guest${queryString}`); break;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading your memberships...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Select Context</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You have multiple memberships. Please select one to continue.
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          {roles.map((r, i) => {
            const clubName = r.club_id ? clubs[r.club_id]?.name : 'System Level';
            const branchName = r.branch_id ? branches[r.branch_id]?.name : '';
            return (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full text-left p-4 border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="font-semibold text-gray-900">{r.role.replace('_', ' ')}</div>
                <div className="text-sm text-gray-500">
                  {clubName} {branchName ? `- ${branchName}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}
