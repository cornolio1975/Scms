import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function runTests() {
  console.log("=== SCMS END-TO-END WORKFLOW TEST ===");

  const timestamp = Date.now();
  const email1 = `test.admin.${timestamp}@example.com`;
  const email2 = `test.manager.${timestamp}@example.com`;
  const email3 = `test.member.${timestamp}@example.com`;
  const password = "Password123!";
  const clubName = `Test Club ${timestamp}`;

  // 1. New Club Signup
  console.log("\n[TEST 1] New Club Signup");
  const { data: user1, error: err1 } = await supabase.auth.signUp({
    email: email1,
    password,
    options: {
      data: {
        full_name: "Test Admin",
        club_name: clubName
      }
    }
  });
  if (err1) throw err1;
  console.log("✓ User signed up:", email1);

  // Wait a moment for trigger
  await new Promise(r => setTimeout(r, 1000));

  // Verify Club and Role
  const { data: roles1, error: rErr1 } = await supabase
    .from('user_roles')
    .select('*, clubs(*)')
    .eq('user_id', user1.user.id);
  
  if (rErr1) throw rErr1;
  
  if (!roles1 || roles1.length !== 1 || roles1[0].role !== 'CLUB_ADMIN') {
    throw new Error("Trigger failed to grant CLUB_ADMIN role.");
  }
  
  const clubId = roles1[0].club_id;
  console.log("✓ Trigger correctly created Club ID:", clubId, "and granted CLUB_ADMIN");

  // 2. Normal Signup (No Club Name)
  console.log("\n[TEST 2] Normal User Signup (No Club)");
  const { data: user2, error: err2 } = await supabase.auth.signUp({
    email: email2,
    password,
    options: {
      data: {
        full_name: "Test Manager",
      }
    }
  });
  if (err2) throw err2;
  
  await new Promise(r => setTimeout(r, 1000));

  const { data: roles2 } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user2.user.id);
  
  if (roles2 && roles2.length > 0) {
    throw new Error("Trigger accidentally granted a role to a normal user!");
  }
  console.log("✓ Normal user signed up without accidental role elevation.");

  // 3. Branch Creation & Assignment
  console.log("\n[TEST 3] Branch Creation and RLS Verification");
  // Admin logs in
  await supabase.auth.signInWithPassword({ email: email1, password });

  // Admin creates branch
  const { data: branch, error: bErr } = await supabase
    .from('club_branches')
    .insert({
      club_id: clubId,
      name: `Branch 1 - ${timestamp}`,
      status: 'Active'
    })
    .select()
    .single();
  if (bErr) throw bErr;
  console.log("✓ Club Admin successfully created a branch:", branch.id);

  // Admin tries to view branch (should succeed)
  const { data: viewB } = await supabase.from('club_branches').select('*').eq('id', branch.id);
  if (!viewB || viewB.length === 0) throw new Error("Admin cannot see their own branch.");
  console.log("✓ Club Admin can view the branch.");

  // Admin assigns role to User 2
  const { error: assignErr } = await supabase
    .from('user_roles')
    .insert({
      user_id: user2.user.id,
      role: 'BRANCH_MANAGER',
      club_id: clubId,
      branch_id: branch.id,
      status: 'Active'
    });
  if (assignErr) throw assignErr;
  console.log("✓ Club Admin successfully assigned User 2 as BRANCH_MANAGER.");

  // 4. Branch Manager RLS constraints
  console.log("\n[TEST 4] Branch Manager RLS Verification");
  await supabase.auth.signInWithPassword({ email: email2, password });

  // Try to read branches
  const { data: bmBranches, error: bmErr } = await supabase.from('club_branches').select('*');
  if (bmErr) throw bmErr;
  if (bmBranches.length !== 1 || bmBranches[0].id !== branch.id) {
    throw new Error("Branch Manager RLS failure: Should only see assigned branch.");
  }
  console.log("✓ Branch Manager can ONLY view their assigned branch.");

  // Try to create another branch
  const { error: bmCreateErr } = await supabase
    .from('club_branches')
    .insert({
      club_id: clubId,
      name: `Branch 2 - ${timestamp}`,
      status: 'Active'
    });
  if (!bmCreateErr) {
    throw new Error("Branch Manager was able to create a branch! RLS failed.");
  }
  console.log("✓ Branch Manager is correctly blocked from creating branches.");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(console.error);
