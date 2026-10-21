import { createClient } from '@/utils/supabase/client';
import type { Member, MemberStatus, SystemRole } from '@/types';

type DbMember = {
  id: string; member_no: string; club_id: string; branch_id: string; profile_id: string | null;
  full_name: string; preferred_name: string | null; gender: string | null; date_of_birth: string | null;
  ic_passport: string | null; nationality: string | null; email: string | null; phone: string | null;
  status: string; joined_date: string | null; sport_data: Record<string, any> | null;
  medical_notes: string | null; emergency_contact: Record<string, any> | null;
  created_at: string; updated_at: string;
  member_roles?: { role: SystemRole }[];
  volunteer_profiles?: { member_id: string } | null;
};

const toMemberStatus = (status?: string | null): MemberStatus => {
  const value = (status || 'ACTIVE').toUpperCase();
  if (value === 'INACTIVE') return 'Inactive';
  if (value === 'SUSPENDED') return 'Suspended';
  if (value === 'ARCHIVED') return 'Archived';
  if (value === 'TRANSFERRED') return 'Transferred';
  return 'Active';
};

export const mapDbMember = (row: DbMember): Member => {
  const roles = new Set((row.member_roles || []).map(item => item.role));
  const emergency = row.emergency_contact || {};
  const sportData = { ...(row.sport_data || {}) };
  if (!sportData.beltRank) {
    sportData.beltRank = [sportData.rankName, sportData.kyu].filter(Boolean).join(' · ') || undefined;
  }

  return {
    id: row.member_no,
    clubId: row.club_id,
    branchId: row.branch_id,
    userId: row.profile_id || undefined,
    fullName: row.full_name,
    preferredName: row.preferred_name || undefined,
    gender: row.gender === 'Female' || row.gender === 'Other' ? row.gender : 'Male',
    dob: row.date_of_birth || '',
    icPassport: row.ic_passport || '',
    nationality: row.nationality || 'Malaysia',
    email: row.email || undefined,
    phone: row.phone || undefined,
    emergencyContactName: String(emergency.name || ''),
    emergencyContactPhone: String(emergency.phone || ''),
    emergencyContactRelation: String(emergency.relationship || ''),
    status: toMemberStatus(row.status),
    isAthlete: roles.has('ATHLETE'),
    isVolunteer: roles.has('VOLUNTEER') || Boolean(row.volunteer_profiles),
    sportData,
    medicalNotes: row.medical_notes || undefined,
    joinedDate: row.joined_date || row.created_at.slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export async function getNormalizedMembers(clubId?: string, branchId?: string): Promise<Member[]> {
  const supabase = createClient();
  let query = supabase
    .from('members')
    .select('*, member_roles(role), volunteer_profiles(member_id)')
    .order('full_name');

  if (clubId) query = query.eq('club_id', clubId);
  if (branchId) query = query.eq('branch_id', branchId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(row => mapDbMember(row as unknown as DbMember));
}


export type CreateMemberInput = {
  clubId: string;
  branchId: string;
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  icPassport: string;
  email?: string;
  phone?: string;
  beltRank?: string;
  weightKg?: number;
  isAthlete?: boolean;
  isVolunteer?: boolean;
};

export async function createNormalizedMember(input: CreateMemberInput): Promise<Member> {
  const supabase = createClient();
  const memberNo = `SCMS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      member_no: memberNo,
      club_id: input.clubId,
      branch_id: input.branchId,
      full_name: input.fullName,
      gender: input.gender,
      date_of_birth: input.dob,
      ic_passport: input.icPassport,
      email: input.email || null,
      phone: input.phone || null,
      status: 'ACTIVE',
      joined_date: new Date().toISOString().slice(0, 10),
      sport_data: {
        beltRank: input.beltRank,
        weightKg: input.weightKg,
      },
    })
    .select('*')
    .single();

  if (memberError) throw memberError;

  const roles: SystemRole[] = ['MEMBER'];
  if (input.isAthlete) roles.push('ATHLETE');
  if (input.isVolunteer) roles.push('VOLUNTEER');

  const { error: roleError } = await supabase.from('member_roles').insert(
    roles.map(role => ({
      member_id: member.id,
      role,
      club_id: input.clubId,
      branch_id: input.branchId,
    }))
  );

  if (roleError) {
    await supabase.from('members').delete().eq('id', member.id);
    throw roleError;
  }

  if (input.isVolunteer) {
    const { error: volunteerError } = await supabase.from('volunteer_profiles').insert({
      member_id: member.id,
      status: 'ACTIVE',
    });
    if (volunteerError) {
      await supabase.from('member_roles').delete().eq('member_id', member.id);
      await supabase.from('members').delete().eq('id', member.id);
      throw volunteerError;
    }
  }

  const { data: created, error: fetchError } = await supabase
    .from('members')
    .select('*, member_roles(role), volunteer_profiles(member_id)')
    .eq('id', member.id)
    .single();

  if (fetchError) throw fetchError;
  return mapDbMember(created as unknown as DbMember);
}
