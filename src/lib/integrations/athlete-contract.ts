/** Shared v1 wire contract. No tournament, payment or medical status is owned by SCMS. */
export type AthletePayload = {
  contract_version: 1;
  source_revision: string;
  scms_member_id: string; scms_club_id: string; scms_branch_id: string | null;
  member_no: string | null; club_name: string; participant_name: string;
  gender: string; date_of_birth: string | null; email: string | null; phone: string | null;
  passport_ic: string | null; nationality_code: string | null;
  weight: number | null; height: number | null; belt_rank: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
};
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
function measure(v: unknown, label: string) {
  if (v === null || v === undefined || v === '') return null;
  const n=Number(v); if (!Number.isFinite(n) || n<=0 || n>999.99) throw Error(`Correct the athlete ${label}`);
  return Math.round(n*100)/100;
}
export function buildAthletePayload(m: Record<string, any>, club: Record<string, any>): AthletePayload {
  const sport=m.sport_data || {}, emergency=m.emergency_contact || {};
  const nation=text(sport.nationalityCode) || text(m.nationality);
  if (nation && !/^[A-Z]{2,3}$/.test(nation)) throw Error('Use an KarateTech country code for athlete nationality');
  return {contract_version:1,source_revision:new Date(m.updated_at).toISOString(),scms_member_id:m.id,scms_club_id:m.club_id,scms_branch_id:m.branch_id || null,
    member_no:text(m.member_no),club_name:club.display_name || club.name,
    participant_name:m.full_name.trim(),gender:m.gender,date_of_birth:m.date_of_birth,
    email:text(m.email),phone:text(m.phone),passport_ic:text(m.ic_passport),nationality_code:nation,
    weight:measure(sport.weightKg,'weight'),height:measure(sport.heightCm,'height'),belt_rank:text(sport.beltRank),
    emergency_contact_name:text(emergency.name),emergency_contact_phone:text(emergency.phone)};
}
export function participantDifferences(expected: AthletePayload, remote: Record<string, any>) {
  return Object.keys(expected).filter(k => {
    const a=expected[k as keyof AthletePayload], b=remote[k];
    // These must be numerically equal after PostgreSQL numeric serialisation.
    if (k==='weight' || k==='height') return a===null ? b!==null : b===null || b===undefined || Number(a)!==Number(b);
    return a!==b;
  });
}
