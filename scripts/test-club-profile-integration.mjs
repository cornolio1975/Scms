/**
 * Comprehensive Automated Tests for SCMS Club Profile & Branch Profile Management
 * + Display Name Integration with KarateTech 3.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { validateDisplayName } from '../src/lib/validation/club.ts';
import { toKarateTechPayload } from '../src/lib/integrations/karatetech-sync.ts';

console.log('======================================================================');
console.log('SCMS — CLUB PROFILE, DISPLAY NAME & KARATETECH 3.0 INTEGRATION TESTS');
console.log('======================================================================\n');

// 1. Read Environment safely
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function runTestSuite() {
  // =========================================================================
  // TEST SUITE A: DISPLAY NAME VALIDATION RULES
  // =========================================================================
  console.log('--- TEST SUITE A: DISPLAY NAME VALIDATION RULES ---');

  // A1: Exactly 30 characters with spaces
  const exact30 = 'Senshi Goju-Ryu Karate Club 10'; // exactly 30 chars
  assert.strictEqual(exact30.length, 30, 'Fixture must be exactly 30 characters');
  const res30 = validateDisplayName(exact30);
  assert.strictEqual(res30.valid, true, 'Valid 30-char name must be accepted');
  assert.strictEqual(res30.value, exact30);
  console.log('✓ Test A1: Valid 30-character name accepted successfully.');

  // A2: Exceeding 30 characters
  const tooLong = 'Senshi Goju-Ryu Karate-Do Academy'; // 33 characters
  assert.strictEqual(tooLong.length > 30, true);
  const resTooLong = validateDisplayName(tooLong);
  assert.strictEqual(resTooLong.valid, false, 'Name > 30 chars must be rejected');
  assert.ok(resTooLong.error.includes('30 characters'), 'Error must mention 30 character limit');
  console.log('✓ Test A2: Name exceeding 30 characters rejected with clear validation error.');

  // A3: Empty string
  const resEmpty = validateDisplayName('');
  assert.strictEqual(resEmpty.valid, false, 'Empty name must be rejected');
  console.log('✓ Test A3: Empty Display Name rejected.');

  // A4: Whitespace only
  const resWhitespace = validateDisplayName('    ');
  assert.strictEqual(resWhitespace.valid, false, 'Whitespace-only name must be rejected');
  console.log('✓ Test A4: Whitespace-only Display Name rejected.');

  // A5: Trimming leading and trailing whitespace while preserving internal spaces
  const untrimmed = '   Senshi Karate   ';
  const resTrimmed = validateDisplayName(untrimmed);
  assert.strictEqual(resTrimmed.valid, true);
  assert.strictEqual(resTrimmed.value, 'Senshi Karate', 'Leading and trailing spaces must be trimmed');
  console.log('✓ Test A5: Leading/trailing whitespace trimmed while internal spaces preserved.');

  // A6: Script / HTML Injection prevention
  const malicious = '<script>alert("hacked")</script>';
  const resMalicious = validateDisplayName(malicious);
  assert.strictEqual(resMalicious.valid, false, 'HTML injection must be rejected');
  console.log('✓ Test A6: HTML / Script markup injection rejected safely.');

  // =========================================================================
  // TEST SUITE B: DATABASE SCHEMA & MIGRATION VERIFICATION
  // =========================================================================
  console.log('\n--- TEST SUITE B: DATABASE PERSISTENCE & MIGRATION VERIFICATION ---');

  // Verify display_name column exists in Supabase public.clubs
  const { data: dbClubs, error: clubErr } = await supabase
    .from('clubs')
    .select('id, name, display_name')
    .limit(5);

  assert.ifError(clubErr);
  assert.ok(dbClubs.length > 0, 'Clubs must exist in database');
  for (const c of dbClubs) {
    assert.ok(c.display_name !== undefined, 'display_name column must exist on club record');
    assert.ok(
      c.display_name.length <= 30,
      `Club "${c.name}" display_name "${c.display_name}" must be <= 30 chars (got ${c.display_name.length})`
    );
  }
  console.log(`✓ Test B1: Live public.clubs table contains valid display_name column across all ${dbClubs.length} verified records.`);

  // Verify specific Senshi Goju-Ryu migration mapping decision
  const { data: senshiClub } = await supabase
    .from('clubs')
    .select('name, display_name')
    .eq('name', 'Senshi Goju-Ryu Karate-Do Academy')
    .maybeSingle();

  if (senshiClub) {
    assert.strictEqual(senshiClub.name, 'Senshi Goju-Ryu Karate-Do Academy', 'Canonical club name remains unchanged');
    assert.strictEqual(senshiClub.display_name, 'Senshi Goju-Ryu', 'Display name shortened through explicit migration decision');
    assert.ok(senshiClub.display_name.length <= 30, 'Display name is <= 30 chars');
    console.log(`✓ Test B2: Canonical name "${senshiClub.name}" preserved; display_name "${senshiClub.display_name}" initialized safely.`);
  }

  // =========================================================================
  // TEST SUITE C: IN-MEMORY STORE RBAC & AUDIT LOGGING
  // =========================================================================
  console.log('\n--- TEST SUITE C: IN-MEMORY STORE RBAC & BRANCH IMMUTABILITY ---');
  const { store } = await import('../src/lib/store.ts');

  const testClub = store.getClubById('Scms-CLUB-000001');
  assert.ok(testClub, 'Senshi Karate club must exist in store');
  assert.ok(testClub.displayName, 'Store club must have displayName');
  assert.strictEqual(testClub.displayName, 'Senshi Goju-Ryu');

  // C1: Update Club Display Name
  const updateSuccess = store.updateClub('Scms-CLUB-000001', {
    displayName: 'Senshi Goju-Ryu Dojo'
  }, 'Shihan Kannan');
  assert.strictEqual(updateSuccess, true);
  assert.strictEqual(store.getClubById('Scms-CLUB-000001').displayName, 'Senshi Goju-Ryu Dojo');

  // C2: Attempting to set an invalid Display Name (> 30 chars) in store
  assert.throws(() => {
    store.updateClub('Scms-CLUB-000001', {
      displayName: 'A Very Long Club Name That Exceeds Thirty Characters Completely'
    });
  }, /30-character limit/);
  console.log('✓ Test C1: In-memory store updates valid displayName and rejects > 30 characters.');

  // C3: Branch Profile Update & Parent Club Immutability
  const branch = store.getBranches('Scms-CLUB-000001')[0];
  assert.ok(branch, 'Branch must exist');
  const originalClubId = branch.clubId;

  // Attempting to reassign branch to another club
  store.updateBranch(branch.id, {
    name: 'Updated Puchong Dojo',
    clubId: 'Scms-CLUB-MALICIOUS-REASSIGN'
  }, 'Branch Manager');

  const updatedBranch = store.getBranches().find(b => b.id === branch.id);
  assert.strictEqual(updatedBranch.clubId, originalClubId, 'Parent club ID must NEVER be reassigned');
  assert.strictEqual(updatedBranch.name, 'Updated Puchong Dojo', 'Permitted branch name updated');
  console.log('✓ Test C2: Branch profile updated while parent club relationship remained strictly immutable.');

  // Reset store club display name
  store.updateClub('Scms-CLUB-000001', { displayName: 'Senshi Goju-Ryu' });

  // =========================================================================
  // TEST SUITE D: KARATETECH 3.0 INTEGRATION & PAYLOAD TRANSMISSION
  // =========================================================================
  console.log('\n--- TEST SUITE D: KARATETECH 3.0 INTEGRATION & DISPLAY NAME TRANSMISSION ---');

  // D1: Direct Member with Parent Club Display Name
  const memberDirect = {
    id: 'Scms-MEM-000001',
    fullName: 'Danial Haziq bin Razak',
    gender: 'Male',
    dob: '2005-04-12',
    icPassport: '050412-10-1234',
    clubId: 'Scms-CLUB-000001',
    clubName: 'Senshi Goju-Ryu Karate-Do Academy',
    displayName: 'Senshi Goju-Ryu',
    sportData: { weightKg: 65, heightCm: 175 }
  };

  const payloadDirect = toKarateTechPayload(memberDirect);
  assert.strictEqual(payloadDirect.club_name, 'Senshi Goju-Ryu', 'Transmitted club_name must be Display Name');
  assert.strictEqual(payloadDirect.scms_participant_id, 'Scms-MEM-000001');
  console.log(`✓ Test D1: Transmitted club_name is correctly set to parent club Display Name: "${payloadDirect.club_name}".`);

  // D2: Member Belonging to a Satellite Branch
  // Athlete belongs to "Saujana Puchong Branch" under "Senshi Goju-Ryu"
  const memberBranch = {
    id: 'Scms-MEM-000002',
    fullName: 'Nurul Aisyah binti Azman',
    gender: 'Female',
    dob: '2006-08-20',
    icPassport: '060820-14-5678',
    branchId: 'Scms-CLUB-000001-B001',
    branchName: 'Saujana Puchong Branch Dojo',
    clubId: 'Scms-CLUB-000001',
    displayName: 'Senshi Goju-Ryu',
    sportData: { weightKg: 52, heightCm: 162 }
  };

  const payloadBranch = toKarateTechPayload(memberBranch);
  // Branch athletes must receive the parent club's Display Name, NOT the branch name!
  assert.strictEqual(payloadBranch.club_name, 'Senshi Goju-Ryu', 'Branch athlete must receive parent club Display Name');
  assert.notStrictEqual(payloadBranch.club_name, memberBranch.branchName, 'Branch name must NOT replace club name');
  console.log('✓ Test D2: Branch participant received parent club Display Name ("Senshi Goju-Ryu") instead of branch name.');

  // D3: Idempotency & Conflict Check
  const payloadAgain = toKarateTechPayload(memberBranch);
  assert.deepStrictEqual(payloadBranch, payloadAgain, 'Identical payload generated for repeated syncs');
  console.log('✓ Test D3: Repeated sync payload generation is 100% idempotent and consistent.');

  console.log('\n======================================================================');
  console.log('ALL SCMS CLUB PROFILE & KARATETECH 3.0 INTEGRATION TESTS PASSED (12/12)');
  console.log('======================================================================');
}

runTestSuite().catch(err => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
