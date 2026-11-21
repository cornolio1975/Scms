import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clubName, scoreboardAbbreviation, registrationNo, address, state, country, adminName, adminEmail, adminPhone, password } = body;

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Use a password with at least 8 characters.' }, { status: 400 });
    }

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
      password,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
      }
    });

    if (authError || !authData.user) {
      if (authError?.message.includes('already exists')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 });
      }
      return NextResponse.json({ error: authError?.message || 'Unable to create an account.' }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Update their profile info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: adminPhone,
        status: 'PENDING'
      })
      .eq('id', userId)
      .select('id')
      .single();

    if (profileError || !profile) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) console.error('Club signup account cleanup failed:', error.code);
      return NextResponse.json({ error: 'Failed to create club administrator profile.' }, { status: 500 });
    }

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
        approval_status: 'PENDING',
        primary_admin_id: userId
      })
      .select('id')
      .single();

    if (clubError) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) console.error('Club signup account cleanup failed:', error.code);
      return NextResponse.json({ error: 'Failed to create club registration' }, { status: 500 });
    }

    // 4. Create an Approval Request for the SuperAdmin
    const { error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        user_id: userId,
        club_id: clubData.id,
        requested_role: 'CLUB_ADMIN',
        status: 'PENDING_APPROVAL'
      });

    if (approvalError) {
      const { error: deleteClubError } = await supabaseAdmin.from('clubs').delete().eq('id', clubData.id);
      if (deleteClubError) {
        console.error('Club signup club cleanup failed:', deleteClubError.code);
      } else {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) console.error('Club signup account cleanup failed:', error.code);
      }
      return NextResponse.json({ error: 'Failed to submit the approval request.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in club registration:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
