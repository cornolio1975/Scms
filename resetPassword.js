const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const email = 'admin@spsportdatasolution.org';
  const password = 'password123!';

  console.log('Fetching user ID from profiles...');
  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
  
  if (profileError || !profile) {
    return console.error('Error finding profile', profileError);
  }

  console.log('Found user:', profile.id);
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password });
  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Password updated successfully!');
  }
}
main();
