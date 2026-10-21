const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  await pgClient.query("DELETE FROM auth.users WHERE email = $1", ['svanathan@gmail.com']);
  console.log('User deleted.');
  
  await pgClient.end();
}
run();
