const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  const email = 'admin@spsportdatasolution.org';
  const password = 'password123!';

  console.log('Testing login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Login failed:', error);
  } else {
    console.log('Login successful! User ID:', data.user.id);
  }
}
main();
