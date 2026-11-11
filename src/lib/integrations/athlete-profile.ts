export const profileFields = ['full_name','gender','dob','passport_ic','email','phone',
  'emergency_contact_name','emergency_contact_phone','weight','height','photo_url','address','nationality_code'] as const;
export type AthleteProfile = Record<(typeof profileFields)[number], string | number | null>;
function nationalityCode(value: unknown): string|null {
 const s=String(value ?? '').trim().toUpperCase();
 return ({MALAYSIAN:'MAS',MALAYSIA:'MAS',SINGAPOREAN:'SGP',SINGAPORE:'SGP',THAI:'THA',THAILAND:'THA',INDONESIAN:'INA',INDONESIA:'INA'} as Record<string,string>)[s] || (/^[A-Z]{3}$/.test(s)?s:null);
}
export function personalProfile(row: any): AthleteProfile {
  const number = (v: unknown) => v == null || v === '' ? null : Number(v);
  const text = (v: unknown) => v == null || v === '' ? null : String(v).trim();
  return {
    full_name: text(row.full_name ?? row.fullName), gender: text(row.gender),
    dob: text(row.dob ?? row.date_of_birth),
    passport_ic: String(row.passport_ic ?? row.ic_passport ?? row.icPassport ?? '').toUpperCase().replace(/[^A-Z0-9]/g,''),
    email: text(row.email),phone: text(row.phone),
    emergency_contact_name: text(row.emergency_contact_name ?? row.emergency_contact?.name ?? row.emergencyContactName),
    emergency_contact_phone: text(row.emergency_contact_phone ?? row.emergency_contact?.phone ?? row.emergencyContactPhone),
    weight: number(row.weight ?? row.sport_data?.weightKg ?? row.sportData?.weightKg),
    height: number(row.height ?? row.sport_data?.heightCm ?? row.sportData?.heightCm),
    photo_url: text(row.photo_url ?? row.photoUrl),
    address:text(row.address),nationality_code:nationalityCode(row.nationality_code ?? row.nationality),
  };
}
export function sameProfile(a: unknown, b: unknown): boolean {
  if (!a || !b) return false;
  const left=personalProfile(a), right=personalProfile(b);
  return profileFields.every(key => left[key] === right[key]);
}
export function memberProfilePatch(row: any, p: AthleteProfile) {
  return {
    full_name:p.full_name,gender:p.gender,date_of_birth:p.dob,ic_passport:p.passport_ic,
    email:p.email,phone:p.phone,photo_url:p.photo_url,address:p.address,nationality:p.nationality_code,
    sport_data:{...(row.sport_data || {}),weightKg:p.weight,heightCm:p.height},
    emergency_contact:{...(row.emergency_contact || {}),name:p.emergency_contact_name,phone:p.emergency_contact_phone},
  };
}
export function browserProfilePatch(row: any, p: AthleteProfile) {
  return {
    fullName:p.full_name,gender:p.gender,dob:p.dob,icPassport:p.passport_ic,
    email:p.email,phone:p.phone,photoUrl:p.photo_url,address:p.address,nationality:p.nationality_code,
    emergencyContactName:p.emergency_contact_name,emergencyContactPhone:p.emergency_contact_phone,
    sportData:{...(row.sportData || {}),weightKg:p.weight,heightCm:p.height},
  };
}
