const { Client } = require('pg');


async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Public tables:', res.rows.map(r => r.table_name));

  const clubs = await client.query('SELECT id, name, display_name FROM public.clubs');
  console.log('Clubs:', clubs.rows);

  const roles = await client.query(`
    SELECT ur.id, ur.club_id, ur.branch_id, ur.role, p.full_name, p.email 
    FROM public.user_roles ur 
    LEFT JOIN public.profiles p ON ur.user_id = p.id
  `);
  console.log('Roles with profiles:', roles.rows);

  await client.end();
}
run().catch(console.error);
