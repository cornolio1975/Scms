import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please log in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      icPassport,
      residentialAddress,
      city,
      state,
      postcode,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      requestedRole,
      avatarUrl,
      photoVisibility,
      otherInfo,
      language,
    } = body;

    // Server-side validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Full name is required (at least 2 characters).' }, { status: 400 });
    }

    if (!icPassport || typeof icPassport !== 'string' || icPassport.trim().length < 4) {
      return NextResponse.json({ success: false, error: 'Valid IC or Passport number is required.' }, { status: 400 });
    }

    if (!residentialAddress || typeof residentialAddress !== 'string' || residentialAddress.trim().length < 5) {
      return NextResponse.json({ success: false, error: 'Full residential address is required.' }, { status: 400 });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return NextResponse.json({ success: false, error: 'Valid contact number is required.' }, { status: 400 });
    }

    if (!emergencyContactName || typeof emergencyContactName !== 'string' || emergencyContactName.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Emergency contact name is required.' }, { status: 400 });
    }

    if (!emergencyContactPhone || typeof emergencyContactPhone !== 'string' || emergencyContactPhone.trim().length < 7) {
      return NextResponse.json({ success: false, error: 'Emergency contact phone number is required.' }, { status: 400 });
    }

    const validRoles = [
      'SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN', 
      'BRANCH_MANAGER', 'COACH', 'STAFF', 'VOLUNTEER', 'OBSERVER', 
      'ATHLETE', 'PARENT', 'MEMBER'
    ];
    const roleToAssign = validRoles.includes(requestedRole) ? requestedRole : 'MEMBER';

    // Update user profile in Supabase
    const profilePayload = {
      id: user.id,
      email: user.email || '',
      full_name: fullName.trim(),
      ic_passport: icPassport.trim().toUpperCase(),
      residential_address: residentialAddress.trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      postcode: (postcode || '').trim(),
      phone: phone.trim(),
      emergency_contact_name: emergencyContactName.trim(),
      emergency_contact_phone: emergencyContactPhone.trim(),
      avatar_url: avatarUrl || null,
      photo_visibility: ['PUBLIC', 'CLUB_ONLY', 'ADMIN_ONLY', 'PRIVATE'].includes(photoVisibility) ? photoVisibility : 'CLUB_ONLY',
      other_info: (otherInfo || '').trim(),
      preferred_language: language === 'ms' ? 'ms' : 'en',
      onboarding_completed: true,
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    };

    // Upsert profile to prevent duplicates
    const { data: updatedProfile, error: profileErr } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select()
      .single();

    if (profileErr) {
      console.error('Onboarding profile update failed:', profileErr);
      return NextResponse.json({ success: false, error: 'Failed to save profile: ' + profileErr.message }, { status: 500 });
    }

    // Assign role in user_roles if not already present
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('id, role')
      .eq('user_id', user.id);

    if (!existingRoles || existingRoles.length === 0) {
      await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: roleToAssign,
          granted_at: new Date().toISOString(),
        });
    }

    // Also update Supabase auth metadata
    await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone: phone.trim(),
        onboarding_completed: true,
      }
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'Onboarding information saved successfully.'
    });

  } catch (err) {
    console.error('Onboarding API error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error'
    }, { status: 500 });
  }
}
