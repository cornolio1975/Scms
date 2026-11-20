import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

import { reviewClubRegistration } from '@/lib/server/club-registration-review';
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to review registrations.' }, { status: 401 });
    }

    const { requestId, action } = await request.json();
    if (typeof requestId !== 'string' || !['APPROVE', 'REJECT', 'SEND_EMAIL'].includes(action)) {
      return NextResponse.json({ error: 'Invalid registration action.' }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'Registration review is unavailable.' }, { status: 503 });
    }
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', user.id);
    if (rolesError) throw rolesError;
    if (!roles?.some(({ role }) => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(role))) {
      return NextResponse.json({ error: 'You do not have permission to review club registrations.' }, { status: 403 });
    }

    // Handle mock Scms- approvals
    if (requestId && requestId.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      const app = store.approvals.find(a => a.id === requestId);
      if (app) {
        if (action === 'SEND_EMAIL') {
          return NextResponse.json({ error: 'This registration has no approval email.' }, { status: 409 });
        }
        if (action === 'APPROVE') {
          store.approveClub(requestId, user.email || user.id);
        } else {
          app.status = 'Rejected';
          app.reviewedByName = user.email || user.id;
          app.reviewedAt = new Date().toISOString();
          if (app.clubId) {
            const club = store.getClubById(app.clubId);
            if (club) club.status = 'Rejected';
          }
        }
        return NextResponse.json({ success: true });
      }
    }

    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    const result = await reviewClubRegistration(supabaseAdmin, requestId, user.id, action);
    return 'error' in result
      ? NextResponse.json({ error: result.error }, { status: result.status })
      : NextResponse.json(result);
  } catch (error) {
    console.error('Club registration review failed:', error);
    return NextResponse.json({ error: 'Unable to review club registration.' }, { status: 500 });
  }
}
