import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { normalizeIdNumber } from '@/lib/excel/athlete-workbook';
import {
  ScopeAuthorizationError,
  fetchAllScopedMembers,
  getServiceAdminClient,
  resolveAuthorizedScope,
} from '@/lib/server/athlete-data-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user: callerUser },
    } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const branchId = searchParams.get('branchId');
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');

    const adminClient = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({
      adminClient,
      userId: callerUser.id,
      clubId,
      branchId,
    });

    const members = await fetchAllScopedMembers({
      adminClient,
      clubId: scope.targetClub.id,
      branchId: scope.targetBranch ? scope.targetBranch.id : null,
      statusFilter,
      searchQuery,
    });

    return NextResponse.json({
      members,
      club: scope.targetClub,
      branch: scope.targetBranch,
      authorizedBranches: scope.authorizedBranches,
    });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user: callerUser },
    } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      email,
      fullName,
      idType,
      icPassport,
      phone,
      address,
      addressLine1,
      addressLine2,
      postcode,
      city,
      state,
      country,
      guardianName,
      guardianPhone,
      clubId,
      branchId,
      gender,
      dob,
      nationality,
      medicalNotes,
      notes,
      assignedCoachName,
      sportData,
      emergencyContact,
    } = body;

    if (!fullName || !clubId) {
      return NextResponse.json(
        { error: 'Full name and Club ID are required.' },
        { status: 400 }
      );
    }

    const adminClient = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({
      adminClient,
      userId: callerUser.id,
      clubId,
      branchId,
    });

    // Check duplicate IC / Passport within the club if IC is provided
    if (icPassport && icPassport.trim()) {
      const normalizedNewIc = normalizeIdNumber(icPassport);
      const existingMembers = await fetchAllScopedMembers({
        adminClient,
        clubId: scope.targetClub.id,
      });
      const duplicate = existingMembers.find(
        (m) =>
          m.ic_passport &&
          normalizeIdNumber(m.ic_passport) === normalizedNewIc
      );

      if (duplicate) {
        return NextResponse.json(
          {
            error: `Duplicate athlete: Member with identification number ${icPassport} already exists in this club (${duplicate.full_name}, ${duplicate.member_no}).`,
          },
          { status: 409 }
        );
      }
    }

    // Never silently pick the first branch or create a default branch.
    const targetBranchId = scope.targetBranch ? scope.targetBranch.id : null;

    const { count } = await adminClient
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', scope.targetClub.id);

    const memberSequence = (count || 0) + 1001;
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedMemberNo = `SCMS-${memberSequence}-${suffix}`;

    const mergedSportData = {
      ...(sportData || {}),
      assignedCoachName:
        assignedCoachName || sportData?.assignedCoachName || null,
      preferredDiscipline: sportData?.preferredDiscipline || 'Kumite',
      beltRank: sportData?.beltRank || 'White',
      weightKg: sportData?.weightKg || null,
      heightCm: sportData?.heightCm || null,
      competitionCategory: sportData?.competitionCategory || null,
    };

    const mergedEmergencyContact = emergencyContact || {
      name: body.emergencyContactName || guardianName || null,
      phone: body.emergencyContactPhone || guardianPhone || null,
      relationship: body.emergencyContactRelationship || 'Parent/Guardian',
    };

    const nowIso = new Date().toISOString();

    const { data: insertedMember, error: memberInsertError } = await adminClient
      .from('members')
      .insert({
        member_no: generatedMemberNo,
        club_id: scope.targetClub.id,
        branch_id: targetBranchId,
        profile_id: null,
        full_name: fullName.trim(),
        gender: gender || null,
        date_of_birth: dob || null,
        id_type: idType || null,
        ic_passport: icPassport ? icPassport.trim() : null,
        nationality: nationality || 'Malaysian',
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        address_line_1: addressLine1 || address || null,
        address_line_2: addressLine2 || null,
        postcode: postcode || null,
        city: city || null,
        state: state || null,
        country: country || 'Malaysia',
        guardian_name: guardianName || null,
        guardian_phone: guardianPhone || null,
        status: 'Active',
        sport_data: mergedSportData,
        notes: notes || medicalNotes || null,
        medical_notes: medicalNotes || notes || null,
        emergency_contact: mergedEmergencyContact,
        joined_date: nowIso.split('T')[0],
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (memberInsertError || !insertedMember) {
      return NextResponse.json(
        {
          error:
            'Failed to create member record: ' +
            (memberInsertError?.message || 'Unknown error'),
        },
        { status: 500 }
      );
    }

    await adminClient.from('member_roles').insert([
      {
        member_id: insertedMember.id,
        role: 'MEMBER',
        club_id: scope.targetClub.id,
        branch_id: targetBranchId,
        granted_by: callerUser.id,
      },
      {
        member_id: insertedMember.id,
        role: 'ATHLETE',
        club_id: scope.targetClub.id,
        branch_id: targetBranchId,
        granted_by: callerUser.id,
      },
    ]);

    return NextResponse.json({
      success: true,
      member: insertedMember,
      message: 'Athlete registered successfully.',
    });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user: callerUser },
    } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      memberId,
      fullName,
      idType,
      icPassport,
      phone,
      email,
      gender,
      dob,
      nationality,
      addressLine1,
      addressLine2,
      postcode,
      city,
      state,
      country,
      guardianName,
      guardianPhone,
      notes,
      medicalNotes,
      assignedCoachName,
      sportData,
      emergencyContact,
      status,
      clubId,
      branchId,
    } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required for update.' },
        { status: 400 }
      );
    }

    const adminClient = getServiceAdminClient();

    // Fetch existing member first
    const { data: existingMember, error: fetchErr } = await adminClient
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (fetchErr || !existingMember) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    // Prevent cross-club manipulation: if clubId is supplied, it MUST match existingMember.club_id
    if (
      clubId &&
      clubId.trim().toLowerCase() !== existingMember.club_id.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Athlete ID belongs to another club. Cross-club updates are not permitted.',
          code: 'ATHLETE_BELONGS_TO_OTHER_CLUB',
        },
        { status: 403 }
      );
    }

    // Verify caller authorization against the existing member's club and branch
    const existingScope = await resolveAuthorizedScope({
      adminClient,
      userId: callerUser.id,
      clubId: existingMember.club_id,
      branchId: existingMember.branch_id,
    });

    // If a different branchId is requested, verify authorization for the destination branch too
    let updatedBranchId: string | null | undefined = undefined;
    if (branchId !== undefined) {
      if (branchId === null || branchId === '') {
        if (existingScope.isBranchManagerOnly) {
          return NextResponse.json(
            {
              error:
                'Forbidden: Branch managers cannot remove branch assignment.',
            },
            { status: 403 }
          );
        }
        updatedBranchId = null;
      } else {
        const destScope = await resolveAuthorizedScope({
          adminClient,
          userId: callerUser.id,
          clubId: existingMember.club_id,
          branchId,
        });
        updatedBranchId = destScope.targetBranch
          ? destScope.targetBranch.id
          : null;
      }
    }

    // Check duplicate IC if changing IC
    if (icPassport && icPassport.trim()) {
      const normNew = normalizeIdNumber(icPassport);
      const normOld = existingMember.ic_passport
        ? normalizeIdNumber(existingMember.ic_passport)
        : '';
      if (normNew !== normOld) {
        const existingMembers = await fetchAllScopedMembers({
          adminClient,
          clubId: existingMember.club_id,
        });
        const dupMember = existingMembers.find(
          (m) =>
            m.id !== memberId &&
            m.ic_passport &&
            normalizeIdNumber(m.ic_passport) === normNew
        );
        if (dupMember) {
          return NextResponse.json(
            {
              error: `Another athlete with identification number ${icPassport} already exists in this club (${dupMember.full_name}).`,
            },
            { status: 409 }
          );
        }
      }
    }

    const currentSportData =
      existingMember.sport_data && typeof existingMember.sport_data === 'object'
        ? existingMember.sport_data
        : {};
    const updatedSportData = {
      ...currentSportData,
      ...(sportData || {}),
      assignedCoachName:
        assignedCoachName !== undefined
          ? assignedCoachName
          : currentSportData.assignedCoachName,
    };

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      sport_data: updatedSportData,
    };

    if (fullName) updatePayload.full_name = fullName.trim();
    if (idType !== undefined) updatePayload.id_type = idType;
    if (icPassport !== undefined)
      updatePayload.ic_passport = icPassport ? icPassport.trim() : null;
    if (phone !== undefined)
      updatePayload.phone = phone ? phone.trim() : null;
    if (email !== undefined)
      updatePayload.email = email ? email.trim() : null;
    if (gender !== undefined) updatePayload.gender = gender;
    if (dob !== undefined) updatePayload.date_of_birth = dob || null;
    if (nationality !== undefined) updatePayload.nationality = nationality;
    if (addressLine1 !== undefined) updatePayload.address_line_1 = addressLine1;
    if (addressLine2 !== undefined) updatePayload.address_line_2 = addressLine2;
    if (postcode !== undefined) updatePayload.postcode = postcode;
    if (city !== undefined) updatePayload.city = city;
    if (state !== undefined) updatePayload.state = state;
    if (country !== undefined) updatePayload.country = country;
    if (guardianName !== undefined) updatePayload.guardian_name = guardianName;
    if (guardianPhone !== undefined) updatePayload.guardian_phone = guardianPhone;
    if (notes !== undefined) updatePayload.notes = notes;
    if (medicalNotes !== undefined) updatePayload.medical_notes = medicalNotes;
    if (status !== undefined) updatePayload.status = status;
    if (updatedBranchId !== undefined) updatePayload.branch_id = updatedBranchId;
    if (emergencyContact) updatePayload.emergency_contact = emergencyContact;

    const { data: updatedMember, error: updateErr } = await adminClient
      .from('members')
      .update(updatePayload)
      .eq('id', memberId)
      .eq('club_id', existingMember.club_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: 'Failed to update member: ' + updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: 'Athlete updated successfully.',
    });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user: callerUser },
    } = await supabaseServer.auth.getUser();

    if (!callerUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const clubId = searchParams.get('clubId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required.' },
        { status: 400 }
      );
    }

    const adminClient = getServiceAdminClient();
    const { data: existingMember, error: fetchErr } = await adminClient
      .from('members')
      .select('id, club_id, branch_id, full_name')
      .eq('id', memberId)
      .single();

    if (fetchErr || !existingMember) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    if (
      clubId &&
      clubId.trim().toLowerCase() !== existingMember.club_id.toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Member belongs to another club.' },
        { status: 403 }
      );
    }

    await resolveAuthorizedScope({
      adminClient,
      userId: callerUser.id,
      clubId: existingMember.club_id,
      branchId: existingMember.branch_id,
    });

    const { error: deleteErr } = await adminClient
      .from('members')
      .delete()
      .eq('id', existingMember.id)
      .eq('club_id', existingMember.club_id);

    if (deleteErr) {
      return NextResponse.json(
        { error: `Failed to delete member: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member deleted successfully.',
    });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
