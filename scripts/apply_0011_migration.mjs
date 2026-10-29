import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
    break;
  }
}

if (!dbUrl) {
  throw new Error('DATABASE_URL not found in .env.local');
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to database for migration 0011...');
  
  const sql = fs.readFileSync('supabase/migrations/0011_user_onboarding_and_profiles.sql', 'utf8');
  await client.query(sql);
  
  console.log('Migration 0011 applied successfully!');
  
  // Verify columns
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    ORDER BY ordinal_position;
  `);
  console.log('Updated profiles columns:', cols.rows.map(r => r.column_name));
  
  // Verify bucket
  const buckets = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';");
  console.log('Avatars bucket:', buckets.rows);
  
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
