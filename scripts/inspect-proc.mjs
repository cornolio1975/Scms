import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Bundar%403575@db.wbwnnjfmfcpzjfbsyrvq.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'scms_upsert_participant' AND n.nspname = 'public';
  `);
  console.log(`Found ${res.rows.length} overloads:`);
  for (const row of res.rows) {
    console.log(`\n--- OID ${row.oid} --- Args: ${row.args}`);
  }
  await client.end();
}

main().catch(console.error);
