import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://burkkjwkgwfmzcdelwqn.supabase.co';
const supabaseKey = 'sb_publishable_mXOj2eeIV1AfffgSPpNXcA_ta0FPwE6';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runLifecycleTests() {
  console.log("=== PARTICIPANT LIFECYCLE SECURITY & TRANSITION TESTS ===");
  
  const timestamp = Date.now();
  const password = "Password123!";
  
  // Create Club Admin
  const adminEmail = `lf.admin.${timestamp}@example.com`;
  const { data: admin } = await supabase.auth.signUp({
    email: adminEmail, password, options: { data: { full_name: "Lifecycle Admin", club_name: `LF Club ${timestamp}` } }
  });
  
  await new Promise(r => setTimeout(r, 1000)); // wait for trigger
  const { data: adminRole } = await supabase.from('user_roles').select('*').eq('user_id', admin.user.id).single();
  const clubId = adminRole.club_id;
  
  // Create normal member
  const memberEmail = `lf.member.${timestamp}@example.com`;
  const { data: member } = await supabase.auth.signUp({
    email: memberEmail, password, options: { data: { full_name: "Lifecycle Member" } }
  });
  
  // Assign member to club with REGISTERED status
  const { data: roleData, error: roleError } = await supabase.from('user_roles').insert({
    user_id: member.user.id,
    club_id: clubId,
    role: 'MEMBER',
    participant_status: 'REGISTERED'
  }).select('*').single();

  if (roleError) throw new Error("Failed to insert member role: " + roleError.message);
  const roleId = roleData.id;

  // Simulate API call to the Next.js API (assuming it's running locally)
  // For the sake of the test, we'll hit Supabase directly or via the endpoint
  // But wait! We need to test the server-side service logic (direct DB access tests RLS)
  
  console.log("\n[TEST 4] Invalid Lifecycle Transition");
  // Try to update REGISTERED -> ACTIVE directly (should be blocked by service, but we'll simulate the service check)
  // Since we are not using the endpoint in this script, we can test RLS
  
  await supabase.auth.signInWithPassword({ email: adminEmail, password });
  
  // 20. Direct database status mutation attempt
  console.log("\n[TEST 20] Direct DB Mutation Attempt");
  const { error: directUpdateError } = await supabase
    .from('user_roles')
    .update({ participant_status: 'ACTIVE' })
    .eq('id', roleId);
  
  // Wait, our RLS on user_roles for Club Admins allows them to UPDATE their club's roles!
  // If we haven't locked down the column, they CAN mutate it.
  // The user said: "Do NOT allow frontend code to execute UPDATE user_roles SET participant_status = ... as an unrestricted operation."
  // We need to write RLS to block direct update of participant_status!
  
  if (!directUpdateError) {
    console.error("TEST FAILED: Club Admin was able to directly mutate participant_status bypassing the service.");
  } else {
    console.log("✓ Direct mutation blocked by RLS.");
  }

  console.log("\nTests paused for backend RLS hardening implementation.");
}

runLifecycleTests().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
