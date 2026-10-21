import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres';

const INITIAL_CLUB_UUID = '11111111-1111-1111-1111-111111111111';
const INITIAL_BRANCH_UUID = '22222222-2222-2222-2222-222222222222';
const INITIAL_USER_UUID = '33333333-3333-3333-3333-333333333333';

async function seed() {
  console.log('Connecting to live database...');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected!');

  try {
    console.log('Starting live data sync...');

    // We only insert if not exists to avoid errors on re-run.
    // Insert Mock User into auth.users (simulate signup)
    await client.query(`
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1, 'authenticated', 'authenticated', 'superadmin@spsportdata.org',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"full_name": "Dato’ Sri Shanker"}'::jsonb,
        now(), now()
      ) ON CONFLICT (id) DO NOTHING;
    `, [INITIAL_USER_UUID]);
    console.log('✓ Synced User: superadmin@spsportdata.org');

    // Insert Mock Club
    await client.query(`
      INSERT INTO public.clubs (id, name, short_name, sport, registration_no, established_year, address, city, state, country, primary_admin_id, status)
      VALUES ($1, 'Senshi Goju-Ryu Karate-Do Academy', 'Senshi Karate', 'Karate', 'C SGR-13884', 2008, 'No. 23, Jalan SP8/14, Saujana Puchong', 'Puchong', 'Selangor', 'Malaysia', $2, 'Active')
      ON CONFLICT (id) DO NOTHING;
    `, [INITIAL_CLUB_UUID, INITIAL_USER_UUID]);
    console.log('✓ Synced Club: Senshi Goju-Ryu Karate-Do Academy');

    // Insert Mock Branch
    await client.query(`
      INSERT INTO public.club_branches (id, club_id, name, address, city, state, country, manager_id, venue_name, status)
      VALUES ($1, $2, 'Dojo Saujana Puchong (HQ)', 'No. 23, Jalan SP8/14, Saujana Puchong', 'Puchong', 'Selangor', 'Malaysia', $3, 'Honbu Dojo Tatami Arena', 'Active')
      ON CONFLICT (id) DO NOTHING;
    `, [INITIAL_BRANCH_UUID, INITIAL_CLUB_UUID, INITIAL_USER_UUID]);
    console.log('✓ Synced Branch: Dojo Saujana Puchong (HQ)');

    // Insert User Role
    await client.query(`
      INSERT INTO public.user_roles (user_id, role, club_id, branch_id)
      VALUES ($1, 'SUPERADMIN', $2, $3)
      ON CONFLICT (user_id, role, club_id, branch_id) DO NOTHING;
    `, [INITIAL_USER_UUID, INITIAL_CLUB_UUID, INITIAL_BRANCH_UUID]);
    console.log('✓ Synced Role: SUPERADMIN');

    console.log('\n=======================================');
    console.log('LIVE DATA SYNC COMPLETED SUCCESSFULLY!');
    console.log('You can now login with: superadmin@spsportdata.org / password123');
    console.log('=======================================');
  } catch (err) {
    console.error('Error during sync:', err);
  } finally {
    await client.end();
  }
}

seed();
