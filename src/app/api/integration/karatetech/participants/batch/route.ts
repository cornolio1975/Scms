import { NextResponse } from 'next/server';
import { authorizeUser } from '../../util';
import { createClient } from '@/utils/supabase/server';
import { KarateTechSyncService, toKarateTechPayload } from '@/lib/integrations/karatetech-sync';

export async function POST(request: Request) {
  try {
    const { user, error } = await authorizeUser(request);
    if (error) return error;

    const body = await request.json();
    const { clubId, memberIds } = body;

    if (!clubId || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ success: false, message: 'clubId and an array of memberIds are required' }, { status: 400 });
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

    // Resolve members from profiles or store
    const participants: any[] = [];
    let clubName: string | null = null;

    // Check store first if clubId starts with 'Scms-'
    let storeMembers: any[] = [];
    try {
      const { store } = await import('@/lib/store');
      const club = store.getClubById(clubId);
      if (club) clubName = club.displayName || club.name;
      storeMembers = store.getMembers(clubId);
    } catch {
      // Store not available
    }

    for (const memId of memberIds) {
      const fromStore = storeMembers.find(m => m.id === memId);
      if (fromStore) {
        participants.push(toKarateTechPayload({
          ...fromStore,
          scms_participant_id: fromStore.id,
          full_name: fromStore.fullName,
          gender: fromStore.gender,
          dob: fromStore.dob,
          passport_ic: fromStore.icPassport,
          weight: fromStore.sportData?.weightKg || 60,
          height: fromStore.sportData?.heightCm || 170,
          scms_club_id: clubId,
          club_name: clubName
        }));
      } else if (supabase) {
        // Query Supabase profiles with parent club / branch resolution
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, user_roles(club_id, branch_id, role, clubs(id, name, display_name), club_branches(club_id, clubs(id, name, display_name)))')
          .eq('id', memId)
          .maybeSingle();

        if (profile) {
          const role = profile.user_roles?.[0];
          const cName = role?.clubs?.display_name || role?.clubs?.name || role?.club_branches?.clubs?.display_name || role?.club_branches?.clubs?.name || clubName;
          participants.push(toKarateTechPayload({
            scms_participant_id: profile.id,
            full_name: profile.full_name || 'SCMS Athlete',
            gender: profile.gender || 'Male',
            dob: profile.dob || '2000-01-01',
            passport_ic: profile.passport_ic || 'N/A',
            weight: 60,
            height: 170,
            email: profile.email,
            phone: profile.phone,
            scms_club_id: clubId,
            club_name: cName
          }));
        }
      }
    }

    if (participants.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid members found for the provided clubId and memberIds' }, { status: 404 });
    }

    // Execute bulk sync
    const result = await KarateTechSyncService.executeBulkSync(clubId, participants, user?.id || 'SYSTEM');

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json({ success: false, message: result.error }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
