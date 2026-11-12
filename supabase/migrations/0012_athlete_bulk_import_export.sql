-- Migration: 0012_athlete_bulk_import_export.sql
-- Purpose: Support complete Excel athlete template download, bulk import (club & branch scoped),
--          optimistic concurrency checks, duplicate prevention under concurrency, and athlete export.

BEGIN;

-- 1. Allow club-level athletes (branch_id IS NULL) without fabricating or picking a random branch.
--    The existing composite foreign key (branch_id, club_id) REFERENCES public.club_branches(id, club_id)
--    uses MATCH SIMPLE by default, which allows branch_id IS NULL while strictly enforcing that any
--    non-null branch_id belongs to the same club_id.
ALTER TABLE public.members
  ALTER COLUMN branch_id DROP NOT NULL;

-- 2. Add explicit athlete columns to public.members so no workbook column is discarded.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_id_type_check'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_id_type_check
      CHECK (id_type IS NULL OR id_type IN ('MyKad', 'MyKid', 'Passport', 'Other'));
  END IF;
END $$;

-- Backfill id_type for existing records where ic_passport is present and id_type is null
UPDATE public.members
SET id_type = CASE
  WHEN ic_passport ~ '^[0-9]{6}-?[0-9]{2}-?[0-9]{4}$' THEN 'MyKad'
  WHEN ic_passport IS NOT NULL AND btrim(ic_passport) <> '' THEN 'Passport'
  ELSE NULL
END
WHERE id_type IS NULL AND ic_passport IS NOT NULL AND btrim(ic_passport) <> '';

-- 3. Sequence for collision-free member_no generation under concurrent bulk imports
CREATE SEQUENCE IF NOT EXISTS public.member_no_seq START WITH 2000 INCREMENT BY 1;

-- 4. Prevent duplicate athletes within the same club under concurrent requests (normalized across spaces/hyphens)
DROP INDEX IF EXISTS public.idx_members_club_ic_passport_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_club_ic_passport_unique
  ON public.members (club_id, regexp_replace(upper(btrim(ic_passport)), '[\s-]+', '', 'g'))
  WHERE ic_passport IS NOT NULL
    AND btrim(ic_passport) <> ''
    AND upper(btrim(ic_passport)) <> 'PENDING';

-- Index for fast club/branch/status scoped exports and directory queries
CREATE INDEX IF NOT EXISTS idx_members_club_branch_status
  ON public.members (club_id, branch_id, status);

-- 5. Extend public.csv_history for auditable bulk import/export jobs and idempotency
ALTER TABLE public.csv_history
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.club_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS created_records INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_records INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unchanged_records INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affected_member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_csv_history_idempotency_key
  ON public.csv_history (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_csv_history_club_created_at
  ON public.csv_history (club_id, created_at DESC);

-- 6. Update helper functions to include SYSTEM_ADMIN and CLUB_CO_ADMIN consistently
CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('SUPERADMIN', 'SYSTEM_ADMIN')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_club_admin(check_club_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('CLUB_ADMIN', 'CLUB_CO_ADMIN')
      AND club_id = check_club_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_branch_manager(check_branch_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF check_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN')
      AND branch_id = check_branch_id
  );
END;
$function$;

-- 7. Tighten members SELECT policy so branch managers only view their assigned branch
DROP POLICY IF EXISTS "Authorized users view members" ON public.members;
CREATE POLICY "Authorized users view members"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_club_admin(club_id)
    OR (branch_id IS NOT NULL AND public.is_branch_manager(branch_id))
    OR (profile_id = (SELECT auth.uid()))
  );

-- Allow club admins and branch managers to view csv_history for their scope
DROP POLICY IF EXISTS "Users view own CSV history" ON public.csv_history;
CREATE POLICY "Users view own CSV history"
  ON public.csv_history
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.uid()) = user_id)
    OR public.is_superadmin()
    OR (club_id IS NOT NULL AND public.is_club_admin(club_id))
    OR (branch_id IS NOT NULL AND public.is_branch_manager(branch_id))
  );

COMMIT;
