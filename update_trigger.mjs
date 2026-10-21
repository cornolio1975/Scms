import { Client } from 'pg';
import fs from 'fs';

const connectionString = "postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sql3 = fs.readFileSync('supabase/migrations/0003_multi_club.sql', 'utf-8');
    await client.query(sql3);
    console.log("Successfully applied 0003_multi_club.sql");

    const sql4 = fs.readFileSync('supabase/migrations/0004_rpc_functions.sql', 'utf-8');
    await client.query(sql4);
    console.log("Successfully applied 0004_rpc_functions.sql");
  } catch (err) {
    console.error("Error applying SQL:", err);
  } finally {
    await client.end();
  }
}

run();
