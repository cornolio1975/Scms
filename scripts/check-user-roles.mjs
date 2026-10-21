import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const urCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_roles';");
  console.log('User_roles columns:', urCols.rows.map(r => r.column_name));
  const urRows = await client.query("SELECT * FROM user_roles;");
  console.log('User_roles rows:', urRows.rows);
  await client.end();
}

main().catch(console.error);
