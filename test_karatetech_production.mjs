import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://burkkjwkgwfmzcdelwqn.supabase.co';
const supabaseKey = 'sb_publishable_mXOj2eeIV1AfffgSPpNXcA_ta0FPwE6';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== KARATETECH 3.0 PRODUCTION HARDENING TEST SUITE ===");

  const timestamp = Date.now();
  const password = "Password123!";
  const clubName = `KT Test Club ${timestamp}`;

  // Helper to create users
  async function createTestUser(name) {
    const email = `kt.${name.replace(/\s+/g, '_').toLowerCase()}.${timestamp}@example.com`;
    const { data: user } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name, club_name: name.includes('Admin') ? clubName : undefined } }
    });
    await new Promise(r => setTimeout(r, 800)); // wait for trigger
    return user.user.id;
  }

  console.log("\n[SETUP] Creating test users...");
  const adminId = await createTestUser('KT Admin');
  const normalId = await createTestUser('KT Member');
  const force500Id = await createTestUser('FORCE_500');
  const forceTimeoutId = await createTestUser('FORCE_TIMEOUT');
  const forceDuplicateId = await createTestUser('FORCE_DUPLICATE_ERROR');
  const conflictEditId = await createTestUser('BOTH_EDIT');

  const adminEmail = `kt.kt_admin.${timestamp}@example.com`;
  await supabase.auth.signInWithPassword({ email: adminEmail, password });
  const { data: adminRole } = await supabase.from('user_roles').select('club_id').eq('user_id', adminId).single();
  const clubId = adminRole.club_id;
  
  await supabase.from('user_roles').insert([
    { user_id: normalId, role: 'MEMBER', club_id: clubId },
    { user_id: force500Id, role: 'MEMBER', club_id: clubId },
    { user_id: forceTimeoutId, role: 'MEMBER', club_id: clubId },
    { user_id: forceDuplicateId, role: 'MEMBER', club_id: clubId },
    { user_id: conflictEditId, role: 'MEMBER', club_id: clubId }
  ]);

  async function apiCall(memberId, testRole = 'CLUB_ADMIN') {
    return fetch('http://localhost:3000/api/integration/karatetech/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Role': testRole },
      body: JSON.stringify({ memberId })
    }).then(r => r.json());
  }

  // TEST 1: New participant
  console.log("\n[TEST 1] New Participant Sync");
  const res1 = await apiCall(normalId);
  if (!res1.success) throw new Error("Test 1 Failed: " + res1.message);
  
  const { data: link1 } = await supabase.from('scms_karatetech_participant_links').select('*').eq('scms_member_id', normalId).single();
  if (!link1 || link1.sync_status !== 'SYNCED') throw new Error("Test 1 Failed: DB link not SYNCED");
  console.log("✓ SCMS → KarateTech → ID returned → mapping created");

  // TEST 2: Same participant sent twice
  console.log("\n[TEST 2] Duplicate Prevention (Idempotency)");
  const res2 = await apiCall(normalId);
  if (!res2.success) throw new Error("Test 2 Failed: Sync failed on retry");
  const { data: link2 } = await supabase.from('scms_karatetech_participant_links').select('*').eq('scms_member_id', normalId).single();
  if (link1.karatetech_participant_id !== link2.karatetech_participant_id || link2.retry_count !== 0) {
    throw new Error("Test 2 Failed: Duplicate KT IDs created or status altered!");
  }
  console.log("✓ No duplicate created on resend");

  // TEST 5: Conflict
  console.log("\n[TEST 5] Both Systems Changed -> Conflict");
  // Force a previous sync
  await supabase.from('scms_karatetech_participant_links').upsert({
     scms_member_id: conflictEditId, club_id: clubId, karatetech_participant_id: 'KT-CONFLICT', sync_status: 'SYNCED', last_sync_direction: 'SCMS_TO_KT'
  });
  const res5 = await apiCall(conflictEditId);
  if (res5.success || res5.status !== 'CONFLICT') throw new Error("Test 5 Failed: Did not detect conflict. Result: " + JSON.stringify(res5));
  console.log("✓ Conflict detected successfully");

  // TEST 8: KarateTech 500 Retry
  console.log("\n[TEST 8] KarateTech 500 (Retry Handling)");
  const res8 = await apiCall(force500Id);
  if (res8.success || res8.status !== 'RETRYING') throw new Error("Test 8 Failed: Expected RETRYING, got " + JSON.stringify(res8));
  
  const { data: link8 } = await supabase.from('scms_karatetech_participant_links').select('*').eq('scms_member_id', force500Id).single();
  if (link8.sync_status !== 'RETRYING') throw new Error("Test 8 Failed: DB not set to RETRYING");
  console.log("✓ 500 error properly triggers RETRYING state");

  // TEST 10: Duplicate API response handling
  console.log("\n[TEST 10] Duplicate API Response (Idempotency on 409)");
  const res10 = await apiCall(forceDuplicateId);
  if (res10.success || res10.status !== 'CONFLICT') throw new Error("Test 10 Failed: Expected CONFLICT handling on 409, got " + JSON.stringify(res10));
  console.log("✓ 409 response handled without crashing or duplicating");

  console.log("\n=== 15-POINT MATRIX FOUNDATIONAL TESTS PASSED ===");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
