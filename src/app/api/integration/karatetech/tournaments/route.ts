import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiUrl = process.env.KARATETECH_API_URL || process.env.NEXT_PUBLIC_KARATETECH_API_URL || 'http://localhost:3001';

  // 1. Primary: Fetch from KarateTech 3.0 API endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiUrl}/api/public/v1/tournaments/upcoming`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data?.tournaments)) {
        return NextResponse.json(data);
      }
    }
  } catch (error: any) {
    console.warn('KarateTech 3.0 API HTTP fetch failed, attempting database fallback:', error?.message);
  }

  // 2. Fallback: Query KarateTech 3.0 Supabase database directly for latest live tournaments
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const ktSupabase = createClient(
      'https://wbwnnjfmfcpzjfbsyrvq.supabase.co',
      'sb_publishable_LWZdt84AzUFvyX0xoHYmug_O8-aQwwW'
    );

    const { data: dbData, error } = await ktSupabase
      .from('tournaments')
      .select('*')
      .ilike('status', 'Published')
      .order('date_iso', { ascending: true });

    if (dbData && dbData.length > 0) {
      const now = new Date();
      const tournaments = dbData.map((t: any) => {
        const isClosed = t.registration_close_iso ? new Date(t.registration_close_iso) < now : false;
        const dateObj = t.date_iso ? new Date(t.date_iso) : new Date();
        return {
          tournamentId: t.id,
          tournamentName: t.name,
          organizer: t.organizer || 'Karate Federation',
          tournamentDate: dateObj.toISOString().split('T')[0],
          startTime: dateObj.toISOString().split('T')[1]?.split('.')[0] || '08:00:00',
          timezone: 'Asia/Kuala_Lumpur',
          venue: t.venue || 'Stadium Arena',
          state: t.city || 'Kuala Lumpur',
          registrationClosingDate: t.registration_close_iso || t.date_iso,
          status: t.status,
          registrationStatus: isClosed ? 'Closed' : 'Open',
          registration: {
            available: !isClosed && t.status?.toLowerCase() === 'published',
            url: `/registration?tournament_id=${t.id}`
          },
          logoUrl: null,
          bannerUrl: null,
          lastUpdatedAt: t.created_at || new Date().toISOString()
        };
      });

      return NextResponse.json({
        success: true,
        data: { tournaments },
        meta: { count: tournaments.length, source: 'karatetech_db' }
      });
    }
  } catch (dbErr: any) {
    console.error('Failed to query KarateTech database directly:', dbErr?.message);
  }

  return NextResponse.json(
    { success: false, error: 'Failed to communicate with KarateTech API' },
    { status: 502 }
  );
}
