import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.wbwnnjfmfcpzjfbsyrvq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clubs';");
  console.log('Clubs Columns:', cols.rows.map(r => r.column_name));
  const res = await client.query('SELECT * FROM clubs LIMIT 5;');
  console.log('KarateTech Clubs count:', res.rows.length);
  console.log('KarateTech Clubs:', res.rows);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
