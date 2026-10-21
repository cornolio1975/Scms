import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clubName, scoreboardAbbreviation, registrationNo, address, state, country, adminName, adminEmail, adminPhone } = body;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'System configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create the user in Auth but DO NOT assign any active roles yet
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: 'password123', // Temporary password
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        temp_password: true,
      }
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Update their profile info
    await supabaseAdmin
      .from('profiles')
      .update({
        phone: adminPhone,
        status: 'PENDING'
      })
      .eq('id', userId);

    // 3. Create the Club as PENDING_APPROVAL
    const { data: clubData, error: clubError } = await supabaseAdmin
      .from('clubs')
      .insert({
        name: clubName,
        registration_no: registrationNo,
        address,
        state,
        country,
        status: 'PENDING_APPROVAL',
        primary_admin_id: userId
      })
      .select('id')
      .single();

    if (clubError) {
      return NextResponse.json({ error: 'Failed to create club registration' }, { status: 500 });
    }

    // 4. Create an Approval Request for the SuperAdmin
    await supabaseAdmin
      .from('approval_requests')
      .insert({
        user_id: userId,
        club_id: clubData.id,
        requested_role: 'CLUB_ADMIN',
        status: 'PENDING_APPROVAL'
      });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in club registration:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
