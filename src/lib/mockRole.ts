'use client';

/**
 * Resolves a logged-in user's management role + club/branch context from the
 * local mock store (Scms- clubs). Used by login, the /dashboard router and
 * AuthContext so all three agree on the same workspace.
 *
 * Branch resolution priority for BRANCH_MANAGER:
 *   1. A branch whose manager assignment (managerId / manager_id / managerName)
 *      points at this member  -> the branch they MANAGE
 *   2. member.branchId         -> the branch they TRAIN at (fallback)
 */

import type { SystemRole } from '@/types';
import { store } from '@/lib/store';

export interface MockRoleResult {
  role: SystemRole;
  clubId: string;
  branchId?: string;
  memberId: string;
  fullName: string;
}

const MANAGEMENT_ROLES: SystemRole[] = ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER'];

const norm = (v?: string | null) => (v || '').toLowerCase().trim();

// Demo accounts that must always resolve to a branch manager
const DEMO_BRANCH_MANAGERS: Record<string, { clubId: string; branchId: string }> = {
  'mbalamsm@gmail.com': { clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001' },
};

function findManagedBranch(branches: any[], keys: (string | null | undefined)[]) {
  const k = keys.map(norm).filter(Boolean);
  // 1st: explicit stable ID / email assignment
  return (
    branches.find((b: any) => k.includes(norm(b.managerId))) ||
    // 2nd: legacy name/email based assignment
    branches.find((b: any) => [b.manager_id, b.managerName].map(norm).some(v => v && k.includes(v)))
  );
}

export function resolveMockRole(email?: string | null, fullName?: string | null): MockRoleResult | null {
  const target = norm(email);
  if (!target) return null;

  for (const club of store.getClubs()) {
    const branches: any[] = store.getBranches(club.id);
    const member = store.getMembers(club.id).find((m: any) => norm(m.email) === target);

    const managedBranch = findManagedBranch(branches, [target, member?.id, member?.fullName]);
    if (!member && !managedBranch) continue;

    const roles: string[] = [...(member?.roles || ['MEMBER'])];
    if (managedBranch && !roles.includes('BRANCH_MANAGER')) roles.push('BRANCH_MANAGER');

    const role = MANAGEMENT_ROLES.find(r => roles.includes(r));
    if (!role) continue;

    return {
      role,
      clubId: club.id,
      branchId: role === 'BRANCH_MANAGER' ? managedBranch?.id || member?.branchId : member?.branchId,
      memberId: member?.id || '',
      fullName: member?.fullName || fullName || '',
    };
  }

  // Demo fallback (only if no assignment was found anywhere)
  const demo = DEMO_BRANCH_MANAGERS[target];
  if (demo) {
    const byName = fullName
      ? findManagedBranch(store.getBranches(demo.clubId), [fullName])
      : undefined;
    return {
      role: 'BRANCH_MANAGER',
      clubId: demo.clubId,
      branchId: byName?.id || demo.branchId,
      memberId: '',
      fullName: fullName || '',
    };
  }

  return null;
}

export function mockRoleRoute(r: MockRoleResult): string {
  let route = '/dashboard/branch';
  if (r.role === 'SUPERADMIN') route = '/dashboard/superadmin';
  else if (r.role === 'CLUB_ADMIN') route = '/dashboard/club';

  const params = new URLSearchParams();
  if (r.clubId) params.append('club_id', r.clubId);
  if (r.branchId) params.append('branch_id', r.branchId);
  const qs = params.toString();
  return qs ? `${route}?${qs}` : route;
}
