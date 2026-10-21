import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const aCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs';");
  console.log('Audit_logs columns:', aCols.rows);
  const apprCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'approval_requests';");
  console.log('Approval_requests columns:', apprCols.rows);
  await client.end();
}

main().catch(console.error);
