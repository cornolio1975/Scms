const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const userId = '96145a95-8dc4-4151-b648-11deca6e01df';
  
  // Set profile status to ACTIVE
  await client.query('UPDATE public.profiles SET status = $1 WHERE id = $2', ['ACTIVE', userId]);
  
  // Insert SUPERADMIN role
  await client.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)', [userId, 'SUPERADMIN']);
  
  console.log('Role granted successfully.');
  await client.end();
}
run();
