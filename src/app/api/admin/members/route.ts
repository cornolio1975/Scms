import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verifyCallerPermission(supabaseServer: any, callerUser: any, clubId: string, branchId?: string | null) {
  const { data: callerRoles } = await supabaseServer
    .from('user_roles')
    .select('role, club_id, branch_id')
    .eq('user_id', callerUser.id);

  const isSuperAdmin = callerRoles?.some((r: any) => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role));
  const isClubAdmin = callerRoles?.some((r: any) => ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role) && r.club_id === clubId);
  const isBranchManager = callerRoles?.some((r: any) => r.role === 'BRANCH_MANAGER' && r.club_id === clubId && (!branchId || r.branch_id === branchId));

  return isSuperAdmin || isClubAdmin || isBranchManager;
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user: callerUser } } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Unauthorized: Please log in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      email,
      fullName,
      icPassport,
      phone,
      address,
      roles,
      clubId,
      branchId,
      gender,
      dob,
      nationality,
      medicalNotes,
      assignedCoachName,
      sportData,
      emergencyContact,
    } = body;

    if (!fullName || !clubId) {
      return NextResponse.json({ error: 'Full name and Club ID are required.' }, { status: 400 });
    }

    // Verify caller permission
    const isAuthorized = await verifyCallerPermission(supabaseServer, callerUser, clubId, branchId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions for this club or branch.' }, { status: 403 });
    }

    const adminClient = getAdminClient();

    // Check duplicate IC / Passport within the club if IC is provided
    if (icPassport && icPassport.trim()) {
      const { data: existingMember } = await adminClient
        .from('members')
        .select('id, full_name, member_no')
        .eq('club_id', clubId)
        .eq('ic_passport', icPassport.trim().toUpperCase())
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({
          error: `Duplicate athlete: Member with IC/Passport ${icPassport} already exists (${existingMember.full_name}, ${existingMember.member_no}).`
        }, { status: 409 });
      }
    }

    // Resolve or find a valid branch_id for the club if not specified
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const { data: defaultBranch } = await adminClient
        .from('club_branches')
        .select('id')
        .eq('club_id', clubId)
        .limit(1)
        .maybeSingle();
      targetBranchId = defaultBranch?.id || null;
    }

    // If still null, create a default Main Dojo branch
    if (!targetBranchId) {
      const { data: newBranch } = await adminClient
        .from('club_branches')
        .insert({
          club_id: clubId,
          name: 'Main Dojo',
          status: 'Active'
        })
        .select('id')
        .single();
      targetBranchId = newBranch?.id;
    }

    // Generate unique member_no (e.g. SCMS-10001)
    const { count } = await adminClient
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId);

    const memberSequence = (count || 0) + 1001;
    const generatedMemberNo = `SCMS-${memberSequence}`;

    // Prepare sport_data JSON
    const mergedSportData = {
      ...(sportData || {}),
      assignedCoachName: assignedCoachName || sportData?.assignedCoachName || null,
      preferredDiscipline: sportData?.preferredDiscipline || 'Kumite',
      beltRank: sportData?.beltRank || 'White',
      weightKg: sportData?.weightKg || null,
      heightCm: sportData?.heightCm || null,
      competitionCategory: sportData?.competitionCategory || null,
    };

    // Prepare emergency_contact JSON
    const mergedEmergencyContact = emergencyContact || {
      name: body.emergencyContactName || null,
      phone: body.emergencyContactPhone || null,
      relationship: body.emergencyContactRelationship || 'Parent/Guardian',
    };

    let userId: string | null = null;

    // If email is provided, optionally find or create the Auth user
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const matched = existingUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

      if (matched) {
        userId = matched.id;
      } else {
        const { data: createdUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: 'password123',
          email_confirm: true,
          user_metadata: {
            full_name: fullName.trim(),
            temp_password: true,
          }
        });
        if (!createAuthErr && createdUser?.user) {
          userId = createdUser.user.id;
        }
      }
    }

    // Insert into members table
    const { data: insertedMember, error: memberInsertError } = await adminClient
      .from('members')
      .insert({
        member_no: generatedMemberNo,
        club_id: clubId,
        branch_id: targetBranchId,
        profile_id: userId,
        full_name: fullName.trim(),
        gender: gender || null,
        date_of_birth: dob || null,
        ic_passport: icPassport ? icPassport.trim().toUpperCase() : null,
        nationality: nationality || 'Malaysian',
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        status: 'Active',
        sport_data: mergedSportData,
        medical_notes: medicalNotes || null,
        emergency_contact: mergedEmergencyContact,
        joined_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (memberInsertError) {
      console.error('Failed to insert member into database:', memberInsertError);
      return NextResponse.json({ error: 'Failed to create member record: ' + memberInsertError.message }, { status: 500 });
    }

    // Assign roles in user_roles if user exists
    if (userId) {
      const assignedRoles = (roles && roles.length > 0) ? roles : ['ATHLETE'];
      const roleInserts = assignedRoles.map((role: string) => ({
        user_id: userId,
        club_id: clubId,
        branch_id: (role === 'BRANCH_MANAGER' && targetBranchId) ? targetBranchId : null,
        role: role,
        participant_status: 'REGISTERED',
      }));

      await adminClient.from('user_roles').upsert(roleInserts, { onConflict: 'user_id,role,club_id,branch_id' });
    }

    return NextResponse.json({
      success: true,
      member: insertedMember,
      message: 'Athlete registered successfully.'
    });

  } catch (err: any) {
    console.error('Error in POST /api/admin/members:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user: callerUser } } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Unauthorized: Please log in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      memberId,
      fullName,
      icPassport,
      phone,
      gender,
      dob,
      nationality,
      medicalNotes,
      assignedCoachName,
      sportData,
      emergencyContact,
      status,
      clubId,
      branchId,
    } = body;

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required for update.' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Fetch existing member
    const { data: existingMember, error: fetchErr } = await adminClient
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (fetchErr || !existingMember) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    const targetClubId = clubId || existingMember.club_id;
    const isAuthorized = await verifyCallerPermission(supabaseServer, callerUser, targetClubId, branchId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to edit this athlete.' }, { status: 403 });
    }

    // Check duplicate IC if changing IC
    if (icPassport && icPassport.trim().toUpperCase() !== existingMember.ic_passport) {
      const { data: dupMember } = await adminClient
        .from('members')
        .select('id, full_name')
        .eq('club_id', targetClubId)
        .eq('ic_passport', icPassport.trim().toUpperCase())
        .neq('id', memberId)
        .maybeSingle();

      if (dupMember) {
        return NextResponse.json({
          error: `Another athlete with IC/Passport ${icPassport} already exists in this club (${dupMember.full_name}).`
        }, { status: 409 });
      }
    }

    // Merge sport_data
    const currentSportData = (existingMember.sport_data && typeof existingMember.sport_data === 'object') ? existingMember.sport_data : {};
    const updatedSportData = {
      ...currentSportData,
      ...(sportData || {}),
      assignedCoachName: assignedCoachName !== undefined ? assignedCoachName : currentSportData.assignedCoachName,
    };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName) updatePayload.full_name = fullName.trim();
    if (icPassport) updatePayload.ic_passport = icPassport.trim().toUpperCase();
    if (phone !== undefined) updatePayload.phone = phone ? phone.trim() : null;
    if (gender !== undefined) updatePayload.gender = gender;
    if (dob !== undefined) updatePayload.date_of_birth = dob;
    if (nationality !== undefined) updatePayload.nationality = nationality;
    if (medicalNotes !== undefined) updatePayload.medical_notes = medicalNotes;
    if (status !== undefined) updatePayload.status = status;
    if (branchId !== undefined) updatePayload.branch_id = branchId;
    updatePayload.sport_data = updatedSportData;
    if (emergencyContact) updatePayload.emergency_contact = emergencyContact;

    const { data: updatedMember, error: updateErr } = await adminClient
      .from('members')
      .update(updatePayload)
      .eq('id', memberId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating member:', updateErr);
      return NextResponse.json({ error: 'Failed to update member: ' + updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: 'Athlete updated successfully.'
    });

  } catch (err: any) {
    console.error('Error in PUT /api/admin/members:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
