import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { KarateTechSyncService, toKarateTechPayload } from '@/lib/integrations/karatetech-sync';

// Browser-only legacy records are an explicit import, never a source of authorization.
export async function POST(request: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in to transfer athletes.' }, { status: 401 });
    const { data: roles, error } = await db.from('user_roles').select('role').eq('user_id', user.id);
    if (error || !roles?.some(r => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role))) {
      return NextResponse.json({ success: false, error: 'Browser-saved athlete imports require a database-verified system administrator. Save the club and athlete to the database for club-manager transfers.' }, { status: 403 });
    }
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 }); }
    if (!/^Scms-CLUB-[A-Za-z0-9-]{1,100}$/.test(body?.clubId || '') ||
        typeof body.clubName !== 'string' || !body.clubName.trim() || body.clubName.length > 150 ||
        !Array.isArray(body.participants) || !body.participants.length || body.participants.length > 100) {
      return NextResponse.json({ success: false, error: 'A saved club name and 1–100 athlete profiles are required.' }, { status: 400 });
    }
    const participants = body.participants.map((p: any) => {
      if (!p || typeof p.id !== 'string' || p.clubId !== body.clubId) throw new Error('An athlete does not belong to the selected saved club.');
      const payload = toKarateTechPayload({ ...p, scms_participant_id: p.id, club_id: body.clubId, scms_club_id: body.clubId, club_name: body.clubName });
      KarateTechSyncService.validatePayload(payload);
      return payload;
    });
    if (new Set(participants.map((p: any) => p.scms_participant_id)).size !== participants.length) throw new Error('Duplicate athlete selection.');
    const result = await KarateTechSyncService.executeBulkSync(body.clubId, participants, user.id, db);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Saved athlete import failed.' }, { status: 422 });
  }
}
