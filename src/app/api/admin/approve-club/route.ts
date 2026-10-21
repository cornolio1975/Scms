import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, action } = body;

    // Handle mock Scms- approvals
    if (requestId && requestId.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      const app = store.approvals.find(a => a.id === requestId);
      if (app) {
        if (action === 'APPROVE') {
          store.approveClub(requestId, 'SuperAdmin');
        } else {
          app.status = 'Rejected';
          app.reviewedByName = 'SuperAdmin';
          app.reviewedAt = new Date().toISOString();
          if (app.clubId) {
            const club = store.getClubById(app.clubId);
            if (club) club.status = 'Rejected';
          }
        }
        return NextResponse.json({ success: true });
      }
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the request
    const { data: approvalRequest, error: reqError } = await supabaseAdmin
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !approvalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const { user_id: proposedAdminId, club_id: clubId } = approvalRequest;

    if (action === 'APPROVE') {
      // 1. Activate Club
      await supabaseAdmin
        .from('clubs')
        .update({ status: 'Active' })
        .eq('id', clubId);

      // 2. Activate Profile
      await supabaseAdmin
        .from('profiles')
        .update({ status: 'ACTIVE' })
        .eq('id', proposedAdminId);

      // 3. Assign CLUB_ADMIN Role
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: proposedAdminId,
          club_id: clubId,
          role: 'CLUB_ADMIN'
        });

      // 4. Update request status
      await supabaseAdmin
        .from('approval_requests')
        .update({ 
          status: 'APPROVED',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

    } else if (action === 'REJECT') {
      // Reject everything
      await supabaseAdmin.from('clubs').update({ status: 'REJECTED' }).eq('id', clubId);
      await supabaseAdmin.from('profiles').update({ status: 'REJECTED' }).eq('id', proposedAdminId);
      await supabaseAdmin.from('approval_requests').update({ 
        status: 'REJECTED',
        reviewed_at: new Date().toISOString()
      }).eq('id', requestId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error approving club:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
