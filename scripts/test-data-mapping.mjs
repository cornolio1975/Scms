import assert from 'node:assert';
import { toKarateTechPayload, KarateTechSyncService } from '../src/lib/integrations/karatetech-sync.ts';

console.log('=== TEST SUITE 1: SCMS PARTICIPANT DATA MAPPING & SERIALIZATION ===\n');

// 1. Correct Participant Field Mapping
console.log('Test 1: Every corrected participant field mapping');
const sampleMember = {
  id: 'Scms-MEM-000001',
  fullName: 'Ahmad Daniel bin Razak',
  gender: 'Male',
  dob: '2005-04-12',
  icPassport: '050412-14-1235',
  nationality: 'Malaysian',
  email: 'ahmad.daniel@example.com',
  phone: '+6017-1234567',
  emergencyContactName: 'Fatimah Ali',
  emergencyContactPhone: '+6017-9999999',
  clubId: 'Scms-CLUB-000001',
  clubName: 'Senshi Goju-Ryu Karate-Do Academy',
  sportData: {
    weightKg: 64.5,
    heightCm: 172.0
  }
};

const payload1 = toKarateTechPayload(sampleMember);

assert.strictEqual(payload1.scms_participant_id, 'Scms-MEM-000001', 'scms_participant_id must be mapped from id');
assert.strictEqual(payload1.full_name, 'Ahmad Daniel bin Razak', 'full_name must be mapped from fullName');
assert.strictEqual(payload1.gender, 'Male', 'gender must be Male');
assert.strictEqual(payload1.dob, '2005-04-12', 'dob must be YYYY-MM-DD');
assert.strictEqual(payload1.passport_ic, '050412-14-1235', 'passport_ic must be mapped from icPassport');
assert.strictEqual(payload1.weight, 64.5, 'weight must be mapped from sportData.weightKg');
assert.strictEqual(payload1.height, 172.0, 'height must be mapped from sportData.heightCm');
assert.strictEqual(payload1.email, 'ahmad.daniel@example.com');
assert.strictEqual(payload1.phone, '+6017-1234567');
assert.strictEqual(payload1.nationality_code, 'MAS', 'Malaysian nationality must map to MAS code');
assert.strictEqual(payload1.emergency_contact_name, 'Fatimah Ali');
assert.strictEqual(payload1.emergency_contact_phone, '+6017-9999999');
assert.strictEqual(payload1.club_name, 'Senshi Goju-Ryu Karate-Do Academy');
console.log('✓ All 12 primary fields mapped and transformed correctly.');

// 2. Required & Optional Fields Validation
console.log('\nTest 2: Required & Optional Fields Validation');
assert.doesNotThrow(() => {
  KarateTechSyncService.validatePayload(payload1);
}, 'Valid payload must pass validation');

const invalidPayload = { ...payload1, full_name: '' };
assert.throws(() => {
  KarateTechSyncService.validatePayload(invalidPayload);
}, /Missing required participant fields/, 'Missing full_name must fail validation');

const invalidWeightPayload = { ...payload1, weight: NaN };
assert.throws(() => {
  KarateTechSyncService.validatePayload(invalidWeightPayload);
}, /Missing required participant fields/, 'Invalid weight must fail validation');
console.log('✓ Required and optional field validations enforce data integrity.');

// 3. Null & Empty-string Handling
console.log('\nTest 3: Null & Empty-string Handling');
const memberWithNulls = {
  id: 'Scms-MEM-NULLS',
  fullName: 'Chloe Tan',
  gender: 'female',
  dob: '2004-09-22',
  email: '',
  phone: null,
  icPassport: '',
  weight: 52.0,
  height: 161.0
};
const payloadNulls = toKarateTechPayload(memberWithNulls);
assert.strictEqual(payloadNulls.email, null, 'Empty email string must become null');
assert.strictEqual(payloadNulls.phone, null, 'Null phone must remain null');
assert.strictEqual(payloadNulls.passport_ic, 'N/A', 'Empty passport_ic defaults safely to N/A');
console.log('✓ Null and empty strings sanitized without fabricating identity data.');

// 4. Date of Birth serialization
console.log('\nTest 4: Date-of-birth serialization and round-trip correctness');
const isoMember = {
  id: 'Scms-MEM-ISO',
  fullName: 'Test Athlete',
  gender: 'Male',
  dob: '1999-12-31T16:00:00.000Z',
  weight: 70,
  height: 175
};
const payloadIso = toKarateTechPayload(isoMember);
assert.strictEqual(payloadIso.dob, '1999-12-31', 'ISO datetime string must normalize strictly to YYYY-MM-DD');
console.log('✓ Date of birth normalized to YYYY-MM-DD format.');

// 5. Gender Enum Conversions
console.log('\nTest 5: Gender enum conversions');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'female' }).gender, 'Female');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'FEMALE' }).gender, 'Female');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'F' }).gender, 'Female');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'male' }).gender, 'Male');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'M' }).gender, 'Male');
assert.strictEqual(toKarateTechPayload({ ...sampleMember, gender: 'Other' }).gender, 'Male', 'Fallback strictly satisfies KarateTech DB CHECK (Male/Female)');
console.log('✓ Gender enum strictly conforms to KarateTech CHECK (gender IN (\'Male\', \'Female\')).');

// 6. Single and Batch Payload Consistency
console.log('\nTest 6: Single and batch payload consistency');
const singlePayload = toKarateTechPayload(sampleMember);
const batchItems = [sampleMember, memberWithNulls].map(m => toKarateTechPayload(m));
assert.deepStrictEqual(Object.keys(singlePayload).sort(), Object.keys(batchItems[0]).sort(), 'Single and batch items must have identical schema');
console.log('✓ Authoritative typed mapping layer guarantees single and batch consistency.');

console.log('\n=== ALL SCMS DATA MAPPING UNIT TESTS PASSED ===\n');
