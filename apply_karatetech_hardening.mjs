import { Client } from 'pg';

const connectionString = "postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Update scms_karatetech_participant_links table
    await client.query(`
      -- Drop the old constraint to allow new statuses
      ALTER TABLE public.scms_karatetech_participant_links DROP CONSTRAINT IF EXISTS scms_karatetech_participant_links_sync_status_check;
      
      -- Add new columns if they do not exist
      ALTER TABLE public.scms_karatetech_participant_links 
        ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_attempted_sync_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_error TEXT,
        ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS conflict_status TEXT CHECK (conflict_status IN ('NONE', 'SCMS_WIN', 'KT_WIN', 'MANUAL_REQUIRED')),
        ADD COLUMN IF NOT EXISTS conflict_reference TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- Add constraint back with expanded statuses
      ALTER TABLE public.scms_karatetech_participant_links 
        ADD CONSTRAINT scms_karatetech_participant_links_sync_status_check 
        CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'UPDATE_REQUIRED', 'CONFLICT', 'FAILED', 'RETRYING', 'DISABLED', 'LINKED', 'DISCONNECTED'));
    `);

    // 2. Create sync_jobs table for the durable queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sync_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        participant_id TEXT NOT NULL,
        club_id UUID REFERENCES public.clubs(id),
        operation TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('SCMS_TO_KT', 'KT_TO_SCMS')),
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING')),
        attempts INT DEFAULT 0,
        scheduled_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        error TEXT,
        payload JSONB,
        result JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Add index for queue workers
      CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_scheduled ON public.sync_jobs (status, scheduled_at);
      
      -- Enable RLS
      ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
      
      -- RLS Policies for sync_jobs
      DROP POLICY IF EXISTS "SuperAdmins manage all sync_jobs" ON public.sync_jobs;
      CREATE POLICY "SuperAdmins manage all sync_jobs" ON public.sync_jobs FOR ALL USING (public.is_superadmin());

      DROP POLICY IF EXISTS "Club Admins manage own club sync_jobs" ON public.sync_jobs;
      CREATE POLICY "Club Admins manage own club sync_jobs" ON public.sync_jobs FOR ALL USING (public.is_club_admin(club_id));
    `);

    // 3. Update sync_history table
    await client.query(`
      ALTER TABLE public.sync_history 
        ADD COLUMN IF NOT EXISTS previous_value JSONB,
        ADD COLUMN IF NOT EXISTS new_value JSONB,
        ADD COLUMN IF NOT EXISTS result_status TEXT,
        ADD COLUMN IF NOT EXISTS request_id TEXT;
    `);

    console.log("Database schema successfully hardened for KarateTech sync.");
  } catch (err) {
    console.error("Database schema update failed:", err);
  } finally {
    await client.end();
  }
}

run();
