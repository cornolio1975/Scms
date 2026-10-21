const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
const envVars = envFile.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) acc[key.trim()] = value.trim();
  return acc;
}, {});

fetch(`${envVars.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name,status`, {
  headers: { 'apikey': envVars.SUPABASE_SERVICE_ROLE_KEY }
}).then(res => res.json()).then(console.log);
