const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  // Find all unconfirmed users and confirm them
  const result = await pgClient.query("UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL RETURNING email");
  
  console.log(`Successfully confirmed ${result.rowCount} users:`);
  result.rows.forEach(r => console.log(`- ${r.email}`));
  
  await pgClient.end();
}
run();
