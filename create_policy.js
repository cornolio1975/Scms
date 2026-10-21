const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  // Create policy allowing users to read their own roles
  await pgClient.query("CREATE POLICY \"Users can read own roles\" ON public.user_roles FOR SELECT USING (auth.uid() = user_id)");
  
  console.log('Policy created.');
  await pgClient.end();
}
run();
