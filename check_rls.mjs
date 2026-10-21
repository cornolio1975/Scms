import { Client } from 'pg';

const connectionString = "postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT polname, polcmd, polqual, polwithcheck 
      FROM pg_policy 
      WHERE polrelid = 'public.club_branches'::regclass;
    `);
    console.log("CLUB_BRANCHES POLICIES:");
    console.table(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
