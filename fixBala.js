const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
const envVars = envFile.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) acc[key.trim()] = value.trim();
  return acc;
}, {});

fetch(`${envVars.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?email=eq.mbalamsm@gmail.com`, {
  method: 'PATCH',
  headers: {
    'apikey': envVars.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${envVars.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'ACTIVE' })
}).then(res => res.text()).then(console.log).catch(console.error);
