-- Add fields used by the integration service without dropping existing data.
BEGIN;
ALTER TABLE public.scms_karatetech_participant_links
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempted_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS conflict_status text DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.scms_karatetech_participant_links
  DROP CONSTRAINT IF EXISTS scms_karatetech_participant_links_sync_status_check;
ALTER TABLE public.scms_karatetech_participant_links
  ADD CONSTRAINT scms_karatetech_participant_links_sync_status_check
  CHECK (sync_status IN ('PENDING','LINKED','SYNCED','CONFLICT','ERROR','DISCONNECTED','RETRYING','FAILED')) NOT VALID;
ALTER TABLE public.sync_history ADD COLUMN IF NOT EXISTS request_id text;
COMMIT;
