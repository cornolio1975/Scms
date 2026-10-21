const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env.local')));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('email', 'mbalamsm@gmail.com').single();
  console.log('Profile:', profile);
}
main();
