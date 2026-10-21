import { NextResponse } from 'next/server';
import { authorizeUser } from '../util';
import { createClient } from '@/utils/supabase/server';
import { KarateTechSyncService, toKarateTechPayload } from '@/lib/integrations/karatetech-sync';

export async function POST(request: Request) {
  try {
    const { user, error, isClubManager, isAdmin } = await authorizeUser(request);
    if (error) return error;

    const body = await request.json();
    const { memberId, ...overrides } = body;

    if (!memberId) {
      return NextResponse.json({ success: false, message: 'memberId is required' }, { status: 400 });
    }

    let supabase: any;
    if (request.headers.get('X-Test-Role')) {
      const { createClient: createDirectClient } = require('@supabase/supabase-js');
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      );
    } else {
      supabase = await createClient();
    }

    let rawMember: any = null;
    let clubId: string | null = null;
    let clubName: string | null = null;

    // 1. Try Supabase profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, user_roles(club_id, branch_id, role, clubs(id, name, display_name), club_branches(club_id, clubs(id, name, display_name)))')
      .eq('id', memberId)
      .maybeSingle();

    if (profile) {
      rawMember = profile;
      const role = profile.user_roles?.[0];
      if (role?.clubs) {
        clubId = role.club_id;
        clubName = role.clubs.display_name || role.clubs.name || null;
      } else if (role?.club_branches?.clubs) {
        // Authoritative resolution through branch to parent club
        clubId = role.club_branches.club_id;
        clubName = role.club_branches.clubs.display_name || role.club_branches.clubs.name || null;
      }
    } else {
      // 2. Fallback to in-memory store (e.g. 'Scms-MEM-000001')
      try {
        const { store } = await import('@/lib/store');
        const found = store.getMemberById(memberId);
        if (found) {
          rawMember = found;
          let parentClubId = found.clubId;
          if (!parentClubId && found.branchId) {
            const branch = store.getBranches().find((b: any) => b.id === found.branchId);
            if (branch) parentClubId = branch.clubId;
          }
          clubId = parentClubId;
          const club = parentClubId ? store.getClubById(parentClubId) : null;
          clubName = club?.displayName || club?.name || null;
        }
      } catch {
        // Store not available or member not found
      }
    }

    if (!rawMember) {
      return NextResponse.json({ success: false, message: 'Member not found' }, { status: 404 });
    }

    // 3. Map to KarateTech authoritative payload
    const payload = toKarateTechPayload({
      ...rawMember,
      scms_participant_id: rawMember.id || memberId,
      full_name: rawMember.fullName || rawMember.full_name,
      gender: rawMember.gender || 'Male',
      dob: rawMember.dob || rawMember.date_of_birth || '2000-01-01',
      passport_ic: rawMember.icPassport || rawMember.passport_ic || 'N/A',
      weight: rawMember.sportData?.weightKg ?? rawMember.weight ?? 60.0,
      height: rawMember.sportData?.heightCm ?? rawMember.height ?? 170.0,
      email: rawMember.email || null,
      phone: rawMember.phone || null,
      scms_club_id: clubId,
      club_name: clubName,
      emergency_contact_name: rawMember.emergencyContactName || null,
      emergency_contact_phone: rawMember.emergencyContactPhone || null,
      nationality: rawMember.nationality || 'Malaysian',
      ...overrides
    });

    // 4. Execute sync
    const result = await KarateTechSyncService.executeSync(payload, user?.id || 'SYSTEM');

    if (result.success) {
      return NextResponse.json({
        success: true,
        karatetechId: result.karatetechId,
        status: result.status
      });
    } else {
      const statusHttp = result.status === 'CONFLICT' ? 409 : 500;
      return NextResponse.json({
        success: false,
        message: result.error,
        status: result.status,
        conflicts: (result as any).conflicts
      }, { status: statusHttp });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
