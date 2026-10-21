const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: clubs } = await supabaseAdmin.from('clubs').select('*');
  console.log('Clubs:', clubs);
  const { data: roles } = await supabaseAdmin.from('user_roles').select('*, profiles(*)');
  console.log('Roles:', roles);
}
main();
