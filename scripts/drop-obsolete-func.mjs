import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Bundar%403575@db.wbwnnjfmfcpzjfbsyrvq.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Dropping obsolete 9-parameter function...');
  await client.query(`
    DROP FUNCTION IF EXISTS public.scms_upsert_participant(character varying, character varying, character varying, date, character varying, character varying, character varying, numeric, numeric);
  `);
  console.log('Dropped successfully.');

  const res = await client.query(`
    SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'scms_upsert_participant' AND n.nspname = 'public';
  `);
  console.log(`Remaining overloads: ${res.rows.length}`);
  for (const row of res.rows) {
    console.log(`OID ${row.oid} args: ${row.args}`);
  }
  await client.end();
}

main().catch(console.error);
