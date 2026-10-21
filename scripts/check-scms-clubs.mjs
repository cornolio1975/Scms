import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const pCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';");
  console.log('Profiles columns:', pCols.rows.map(r => r.column_name));

  const sampleProfiles = await client.query("SELECT * FROM profiles LIMIT 3;");
  console.log('Sample profiles:', sampleProfiles.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
