const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

const supabase = createClient('https://burkkjwkgwfmzcdelwqn.supabase.co', 'sb_publishable_mXOj2eeIV1AfffgSPpNXcA_ta0FPwE6');

async function run() {
  await pgClient.connect();
  const email = 'admin@spsportdatasolution.org';
  const password = 'Password@123';
  
  // 1. Delete existing user via PG
  await pgClient.query("DELETE FROM auth.users WHERE email = $1", [email]);
  console.log('Old user deleted from auth.users');
  
  // 2. Re-create using Supabase JS (so it hashes the password properly!)
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { full_name: 'Super Admin' }
    }
  });
  
  if (error) {
    console.error('SignUp Error:', error);
    await pgClient.end();
    return;
  }
  
  const userId = data.user.id;
  console.log('New user created with ID:', userId);
  
  // 3. Confirm the email directly in DB
  await pgClient.query("UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1", [userId]);
  
  // 4. Set profile status to ACTIVE
  await pgClient.query("UPDATE public.profiles SET status = 'ACTIVE' WHERE id = $1", [userId]);
  
  // 5. Insert SUPERADMIN role
  await pgClient.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'SUPERADMIN')", [userId]);
  
  console.log('Superadmin fully setup with new password!');
  await pgClient.end();
}
run();
