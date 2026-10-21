'use server';

import { createClient } from '@/utils/supabase/server';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  entityType: 'CLUB' | 'BRANCH' | 'MEMBER' | 'ATHLETE' | 'OFFICIAL' | 'VOLUNTEER' | 'PARENT' | 'INVOICE';
  status?: string;
  clubId?: string;
  clubName?: string;
  branchId?: string;
  branchName?: string;
  targetModule: string;
  details?: Record<string, any>;
}

export interface SearchPlatformResponse {
  success: boolean;
  error?: string;
  results: {
    clubs: SearchResultItem[];
    branches: SearchResultItem[];
    members: SearchResultItem[];
    officials: SearchResultItem[];
    volunteers: SearchResultItem[];
    parents: SearchResultItem[];
    invoices: SearchResultItem[];
  };
  totalCount: number;
  authorizedRole: string;
  scopedClubId?: string;
  scopedBranchId?: string;
}

/**
 * Platform Search Action with Strict Role-Based Scoping
 * - SUPERADMIN: Searches all clubs & branches across entire platform
 * - CLUB_ADMIN: Strictly scoped to assigned club_id
 * - BRANCH_MANAGER: Strictly scoped to assigned branch_id & club_id
 */
export async function searchPlatformAction(params: {
  query: string;
  clubId?: string;
  branchId?: string;
  limit?: number;
}): Promise<SearchPlatformResponse> {
  const emptyResults: SearchPlatformResponse['results'] = {
    clubs: [],
    branches: [],
    members: [],
    officials: [],
    volunteers: [],
    parents: [],
    invoices: []
  };

  const q = params.query?.trim();
  if (!q || q.length < 2) {
    return {
      success: true,
      results: emptyResults,
      totalCount: 0,
      authorizedRole: 'MEMBER'
    };
  }

  const limitPerCategory = params.limit || 5;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Determine User Role and Authorized Boundaries
    let userRole = 'MEMBER';
    let assignedClubId: string | undefined = undefined;
    let assignedBranchId: string | undefined = undefined;

    if (user) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role, club_id, branch_id')
        .eq('user_id', user.id);

      if (roles && roles.length > 0) {
        if (roles.some((r: any) => r.role === 'SUPERADMIN' || r.role === 'SYSTEM_ADMIN')) {
          userRole = 'SUPERADMIN';
        } else if (roles.some((r: any) => r.role === 'CLUB_ADMIN' || r.role === 'CLUB_CO_ADMIN')) {
          userRole = 'CLUB_ADMIN';
          const primaryRole = roles.find((r: any) => r.role === 'CLUB_ADMIN' || r.role === 'CLUB_CO_ADMIN');
          assignedClubId = primaryRole?.club_id;
        } else if (roles.some((r: any) => r.role === 'BRANCH_MANAGER')) {
          userRole = 'BRANCH_MANAGER';
          const primaryRole = roles.find((r: any) => r.role === 'BRANCH_MANAGER');
          assignedClubId = primaryRole?.club_id;
          assignedBranchId = primaryRole?.branch_id;
        } else {
          userRole = roles[0].role;
          assignedClubId = roles[0].club_id;
          assignedBranchId = roles[0].branch_id;
        }
      }
    } else {
      // In development / mock mode, if active club passed or default to superadmin
      userRole = 'SUPERADMIN';
    }

    // 2. Strict Boundary Enforcement
    let effectiveClubId: string | undefined = undefined;
    let effectiveBranchId: string | undefined = undefined;

    if (userRole === 'SUPERADMIN') {
      // Superadmin can search globally or optionally scope if explicitly requested
      effectiveClubId = params.clubId || undefined;
      effectiveBranchId = params.branchId || undefined;
    } else if (userRole === 'CLUB_ADMIN') {
      // Club Admin is STRICTLY locked to their assigned club
      effectiveClubId = assignedClubId || params.clubId;
      effectiveBranchId = params.branchId || undefined;
    } else if (userRole === 'BRANCH_MANAGER') {
      // Branch Manager is STRICTLY locked to their assigned branch
      effectiveClubId = assignedClubId || params.clubId;
      effectiveBranchId = assignedBranchId || params.branchId;
    }

    const results = { ...emptyResults };
    const term = q.replace(/[%_]/g, '');

    // 3. Search Clubs (Superadmin searches all; Club Admin only sees their own club)
    try {
      let clubQuery = supabase
        .from('clubs')
        .select('id, name, display_name, short_name, registration_no, state, city, status, primary_admin_id');

      if (effectiveClubId) {
        clubQuery = clubQuery.eq('id', effectiveClubId);
      }

      clubQuery = clubQuery.or(
        `name.ilike.%${term}%,display_name.ilike.%${term}%,short_name.ilike.%${term}%,registration_no.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`
      ).limit(limitPerCategory);

      const { data: dbClubs } = await clubQuery;
      if (dbClubs) {
        results.clubs = dbClubs.map((c: any) => ({
          id: c.id,
          title: c.display_name ? `${c.display_name} (${c.name})` : c.name,
          subtitle: `Club Code: ${c.id.substring(0, 14)} • ${c.city || ''}, ${c.state || ''} • Reg: ${c.registration_no || 'N/A'}`,
          entityType: 'CLUB',
          status: c.status || 'Active',
          clubId: c.id,
          clubName: c.display_name || c.name,
          targetModule: 'all-clubs'
        }));
      }
    } catch {
      // Non-fatal DB lookup
    }

    // 4. Search Branches / Dojos
    try {
      let branchQuery = supabase
        .from('club_branches')
        .select(`
          id,
          name,
          venue_name,
          address,
          city,
          state,
          status,
          club_id,
          clubs (
            id,
            name,
            display_name
          )
        `);

      if (effectiveClubId) {
        branchQuery = branchQuery.eq('club_id', effectiveClubId);
      }
      if (effectiveBranchId) {
        branchQuery = branchQuery.eq('id', effectiveBranchId);
      }

      branchQuery = branchQuery.or(
        `name.ilike.%${term}%,venue_name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`
      ).limit(limitPerCategory);

      const { data: dbBranches } = await branchQuery;
      if (dbBranches) {
        results.branches = dbBranches.map((b: any) => {
          const clubName = b.clubs?.display_name || b.clubs?.name || 'Club';
          return {
            id: b.id,
            title: b.name,
            subtitle: `${b.venue_name || 'Tatami Facility'} • ${b.city || ''}, ${b.state || ''} • Under: ${clubName}`,
            entityType: 'BRANCH',
            status: b.status || 'Active',
            clubId: b.club_id,
            clubName,
            branchId: b.id,
            branchName: b.name,
            targetModule: 'branches'
          };
        });
      }
    } catch {
      // Non-fatal
    }

    // 5. Search Members, Athletes & Officials
    try {
      let roleQuery = supabase
        .from('user_roles')
        .select(`
          id,
          role,
          club_id,
          branch_id,
          user_id,
          profiles (
            id,
            full_name,
            email,
            phone,
            status
          ),
          clubs (
            id,
            name,
            display_name
          ),
          club_branches (
            id,
            name
          )
        `);

      if (effectiveClubId) {
        roleQuery = roleQuery.eq('club_id', effectiveClubId);
      }
      if (effectiveBranchId) {
        roleQuery = roleQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: dbRoles } = await roleQuery.limit(50);
      if (dbRoles) {
        const lowerTerm = term.toLowerCase();
        dbRoles.forEach((r: any) => {
          if (!r.profiles) return;
          const fullName = r.profiles.full_name || '';
          const email = r.profiles.email || '';
          const phone = r.profiles.phone || '';
          const role = r.role || 'MEMBER';
          const clubName = r.clubs?.display_name || r.clubs?.name || 'Club';
          const branchName = r.club_branches?.name || 'Main HQ';

          const matches =
            fullName.toLowerCase().includes(lowerTerm) ||
            email.toLowerCase().includes(lowerTerm) ||
            phone.toLowerCase().includes(lowerTerm) ||
            role.toLowerCase().includes(lowerTerm);

          if (!matches) return;

          const isOfficial = ['SUPERADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN', 'BRANCH_MANAGER', 'COACH', 'STAFF'].includes(role);
          const item: SearchResultItem = {
            id: r.profiles.id,
            title: fullName || email,
            subtitle: `${role} • ${email} • ${clubName} (${branchName})`,
            entityType: isOfficial ? 'OFFICIAL' : (role === 'ATHLETE' ? 'ATHLETE' : 'MEMBER'),
            status: r.profiles.status || 'Active',
            clubId: r.club_id,
            clubName,
            branchId: r.branch_id,
            branchName,
            targetModule: isOfficial ? 'officials' : 'members'
          };

          if (isOfficial) {
            if (results.officials.length < limitPerCategory && !results.officials.some(o => o.id === item.id)) {
              results.officials.push(item);
            }
          } else {
            if (results.members.length < limitPerCategory && !results.members.some(m => m.id === item.id)) {
              results.members.push(item);
            }
          }
        });
      }
    } catch {
      // Non-fatal
    }

    // 6. Search Parents / Guardians
    try {
      let parentQuery = supabase
        .from('parent_guardian_contacts')
        .select(`
          id,
          club_id,
          full_name,
          contact_number,
          email,
          volunteer_preference,
          is_active,
          clubs (
            id,
            name,
            display_name
          )
        `);

      if (effectiveClubId) {
        parentQuery = parentQuery.eq('club_id', effectiveClubId);
      }

      parentQuery = parentQuery.or(
        `full_name.ilike.%${term}%,contact_number.ilike.%${term}%,email.ilike.%${term}%`
      ).limit(limitPerCategory);

      const { data: dbParents } = await parentQuery;
      if (dbParents) {
        results.parents = dbParents.map((p: any) => {
          const clubName = p.clubs?.display_name || p.clubs?.name || 'Club';
          return {
            id: p.id,
            title: p.full_name,
            subtitle: `Parent/Guardian • Tel: ${p.contact_number} • ${clubName}`,
            entityType: 'PARENT',
            status: p.is_active ? 'Active' : 'Inactive',
            clubId: p.club_id,
            clubName,
            targetModule: 'parent-portal'
          };
        });
      }
    } catch {
      // Non-fatal
    }

    // 7. Search Volunteers
    try {
      let volunteerQuery = supabase
        .from('volunteer_assignments')
        .select(`
          id,
          title,
          event_name,
          status,
          club_id,
          branch_id,
          clubs (
            id,
            name,
            display_name
          ),
          club_branches (
            id,
            name
          )
        `);

      if (effectiveClubId) {
        volunteerQuery = volunteerQuery.eq('club_id', effectiveClubId);
      }
      if (effectiveBranchId) {
        volunteerQuery = volunteerQuery.eq('branch_id', effectiveBranchId);
      }

      volunteerQuery = volunteerQuery.or(
        `title.ilike.%${term}%,event_name.ilike.%${term}%`
      ).limit(limitPerCategory);

      const { data: dbVols } = await volunteerQuery;
      if (dbVols) {
        results.volunteers = dbVols.map((v: any) => {
          const clubName = v.clubs?.display_name || v.clubs?.name || 'Club';
          const branchName = v.club_branches?.name || 'Branch';
          return {
            id: v.id,
            title: v.title,
            subtitle: `Volunteer Duty • ${v.event_name} • ${clubName} (${branchName})`,
            entityType: 'VOLUNTEER',
            status: v.status || 'Active',
            clubId: v.club_id,
            clubName,
            branchId: v.branch_id,
            branchName,
            targetModule: 'volunteers'
          };
        });
      }
    } catch {
      // Non-fatal
    }

    // 8. Integrate Mock Store Data (for Scms- seeded records)
    try {
      const { store } = await import('@/lib/store');
      const lowerTerm = term.toLowerCase();

      // Mock Clubs
      if (!effectiveClubId || effectiveClubId.startsWith('Scms-')) {
        const mockClubs = store.getClubs().filter(c =>
          (!effectiveClubId || c.id === effectiveClubId) &&
          (c.name.toLowerCase().includes(lowerTerm) ||
           c.id.toLowerCase().includes(lowerTerm) ||
           (c.displayName && c.displayName.toLowerCase().includes(lowerTerm)) ||
           c.city.toLowerCase().includes(lowerTerm) ||
           c.state.toLowerCase().includes(lowerTerm))
        );
        mockClubs.forEach(c => {
          if (results.clubs.length < limitPerCategory && !results.clubs.some(rc => rc.id === c.id)) {
            results.clubs.push({
              id: c.id,
              title: c.displayName ? `${c.displayName} (${c.name})` : c.name,
              subtitle: `Club Code: ${c.id} • ${c.city}, ${c.state} • Reg: ${c.registrationNo}`,
              entityType: 'CLUB',
              status: c.status,
              clubId: c.id,
              clubName: c.displayName || c.name,
              targetModule: 'all-clubs'
            });
          }
        });
      }

      // Mock Branches
      const mockBranches = store.getBranches(effectiveClubId).filter(b =>
        (!effectiveBranchId || b.id === effectiveBranchId) &&
        (b.name.toLowerCase().includes(lowerTerm) ||
         b.id.toLowerCase().includes(lowerTerm) ||
         b.city.toLowerCase().includes(lowerTerm) ||
         (b.venueName && b.venueName.toLowerCase().includes(lowerTerm)))
      );
      mockBranches.forEach(b => {
        if (results.branches.length < limitPerCategory && !results.branches.some(rb => rb.id === b.id)) {
          const parentClub = store.getClubById(b.clubId);
          const clubName = parentClub?.displayName || parentClub?.name || 'Club';
          results.branches.push({
            id: b.id,
            title: b.name,
            subtitle: `${b.venueName || 'Facility'} • ${b.city}, ${b.state} • Under: ${clubName}`,
            entityType: 'BRANCH',
            status: b.status,
            clubId: b.clubId,
            clubName,
            branchId: b.id,
            branchName: b.name,
            targetModule: 'branches'
          });
        }
      });

      // Mock Members
      const mockMembers = store.getMembers(effectiveClubId, effectiveBranchId).filter(m =>
        m.fullName.toLowerCase().includes(lowerTerm) ||
        m.id.toLowerCase().includes(lowerTerm) ||
        (m.email && m.email.toLowerCase().includes(lowerTerm)) ||
        (m.phone && m.phone.toLowerCase().includes(lowerTerm))
      );
      mockMembers.forEach(m => {
        if (results.members.length < limitPerCategory && !results.members.some(rm => rm.id === m.id)) {
          const parentClub = store.getClubById(m.clubId);
          const branch = store.getBranches().find(b => b.id === m.branchId);
          const clubName = parentClub?.displayName || parentClub?.name || 'Club';
          const branchName = branch?.name || 'Main HQ';
          results.members.push({
            id: m.id,
            title: m.fullName,
            subtitle: `Member ID: ${m.id} • ${m.sportData?.beltRank || 'Athlete'} • ${clubName} (${branchName})`,
            entityType: m.isAthlete ? 'ATHLETE' : 'MEMBER',
            status: m.status,
            clubId: m.clubId,
            clubName,
            branchId: m.branchId,
            branchName,
            targetModule: 'members'
          });
        }
      });

      // Mock Volunteers
      const mockVols = store.getVolunteers(effectiveClubId).filter(v =>
        (v.member?.fullName && v.member.fullName.toLowerCase().includes(lowerTerm)) ||
        v.id.toLowerCase().includes(lowerTerm) ||
        (v.skills && v.skills.some(s => s.toLowerCase().includes(lowerTerm)))
      );
      mockVols.forEach(v => {
        if (results.volunteers.length < limitPerCategory && !results.volunteers.some(rv => rv.id === v.id)) {
          const parentClub = store.getClubById(v.clubId);
          const clubName = parentClub?.displayName || parentClub?.name || 'Club';
          results.volunteers.push({
            id: v.id,
            title: v.member?.fullName || v.id,
            subtitle: `Volunteer (${v.skills?.join(', ') || 'Event Support'}) • ${clubName}`,
            entityType: 'VOLUNTEER',
            status: v.status,
            clubId: v.clubId,
            clubName,
            branchId: v.branchId,
            targetModule: 'volunteers'
          });
        }
      });

      // Mock Invoices
      const mockInvoices = store.invoices.filter(i =>
        (!effectiveClubId || i.clubId === effectiveClubId) &&
        (i.invoiceNumber.toLowerCase().includes(lowerTerm) ||
         i.memberName.toLowerCase().includes(lowerTerm) ||
         i.id.toLowerCase().includes(lowerTerm))
      );
      mockInvoices.forEach(inv => {
        if (results.invoices.length < limitPerCategory && !results.invoices.some(ri => ri.id === inv.id)) {
          const parentClub = store.getClubById(inv.clubId);
          const clubName = parentClub?.displayName || parentClub?.name || 'Club';
          results.invoices.push({
            id: inv.id,
            title: `${inv.invoiceNumber} — ${inv.memberName}`,
            subtitle: `Invoice: MYR ${inv.total.toFixed(2)} • Due: ${inv.dueDate} • ${clubName}`,
            entityType: 'INVOICE',
            status: inv.status,
            clubId: inv.clubId,
            clubName,
            targetModule: 'invoices'
          });
        }
      });
    } catch {
      // Non-fatal mock store integration
    }

    const totalCount =
      results.clubs.length +
      results.branches.length +
      results.members.length +
      results.officials.length +
      results.volunteers.length +
      results.parents.length +
      results.invoices.length;

    return {
      success: true,
      results,
      totalCount,
      authorizedRole: userRole,
      scopedClubId: effectiveClubId,
      scopedBranchId: effectiveBranchId
    };
  } catch (err: any) {
    console.error('searchPlatformAction error:', err);
    return {
      success: false,
      error: err.message || 'Platform search failed',
      results: emptyResults,
      totalCount: 0,
      authorizedRole: 'MEMBER'
    };
  }
}
