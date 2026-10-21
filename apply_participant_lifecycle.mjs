import { Client } from 'pg';

const connectionString = "postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Add participant_status to user_roles
    await client.query(`
      ALTER TABLE public.user_roles 
      ADD COLUMN IF NOT EXISTS participant_status TEXT DEFAULT 'REGISTERED' 
      CHECK (participant_status IN ('REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SYNC_PENDING', 'SYNCED', 'ACTIVE', 'REJECTED', 'CONFLICT', 'SYNC_FAILED', 'INACTIVE', 'ARCHIVED'));
    `);

    // 2. We should also enhance approval_requests to support the new types of approvals (e.g. 'PARTICIPANT_CHANGE')
    await client.query(`
      ALTER TABLE public.approval_requests 
      ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'ROLE_ASSIGNMENT' 
      CHECK (request_type IN ('ROLE_ASSIGNMENT', 'PARTICIPANT_CHANGE', 'KARATETECH_RECONCILIATION'));
      
      ALTER TABLE public.approval_requests 
      ADD COLUMN IF NOT EXISTS previous_data JSONB,
      ADD COLUMN IF NOT EXISTS requested_data JSONB;
    `);

    console.log("Database schema successfully updated for Participant Lifecycle.");
  } catch (err) {
    console.error("Database schema update failed:", err);
  } finally {
    await client.end();
  }
}

run();
