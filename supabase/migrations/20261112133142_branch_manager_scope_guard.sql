-- Enforce strict branch-level RLS isolation for branch-only roles (`BRANCH_MANAGER` and `BRANCH_CO_ADMIN`),
-- protect read-only profile emails, restrict branch updates by branch managers to non-ownership fields,
-- and provide an atomic transactional RPC for assigning/replacing a branch manager.

CREATE OR REPLACE FUNCTION public.has_branch_only_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN')
  )
  AND NOT public.is_superadmin();
$$;

REVOKE ALL ON FUNCTION public.has_branch_only_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_branch_only_role() TO authenticated, service_role;

-- Tighten EXECUTE permissions on find_profile_by_email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'find_profile_by_email'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated, service_role';
  END IF;
END $$;

-- Prevent non-service-role users from changing their login email in public.profiles
CREATE OR REPLACE FUNCTION public.guard_profile_email_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email address is your login ID and cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_email_immutable ON public.profiles;
CREATE TRIGGER trg_guard_profile_email_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_email_immutable();

-- Allow branch managers to update their assigned branch's facility details,
-- while guarding ownership/governance columns (club_id, manager_id, archiving) via trigger.
DROP POLICY IF EXISTS "Authorized admins update branches" ON public.club_branches;
CREATE POLICY "Authorized admins update branches"
  ON public.club_branches
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_club_admin(club_id)
    OR public.is_branch_manager(id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_club_admin(club_id)
    OR public.is_branch_manager(id)
  );

CREATE OR REPLACE FUNCTION public.guard_club_branch_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_superadmin()
     AND NOT public.is_club_admin(OLD.club_id)
  THEN
    IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
      RAISE EXCEPTION 'Branch managers cannot transfer a branch to another club.';
    END IF;
    IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
      RAISE EXCEPTION 'Branch managers cannot reassign branch manager ownership.';
    END IF;
    IF NEW.status = 'Archived' AND OLD.status IS DISTINCT FROM 'Archived' THEN
      RAISE EXCEPTION 'Branch managers cannot archive a branch.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_club_branch_update ON public.club_branches;
CREATE TRIGGER trg_guard_club_branch_update
  BEFORE UPDATE ON public.club_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_club_branch_update();

-- Restrictive policies on branch-scoped tables so branch-only managers cannot read or write
-- club-wide (branch_id IS NULL) or other-branch records, even if they hold secondary member/coach roles.
-- Club admins (public.is_club_admin) retain full club-wide access even if they also hold a branch role.

DROP POLICY IF EXISTS branch_manager_scope_guard ON public.club_branches;
CREATE POLICY branch_manager_scope_guard
  ON public.club_branches
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.has_branch_only_role()
    OR public.is_club_admin(club_id)
    OR public.is_branch_manager(id)
  )
  WITH CHECK (
    NOT public.has_branch_only_role()
    OR public.is_club_admin(club_id)
    OR public.is_branch_manager(id)
  );

DO $$
DECLARE
  tbl text;
BEGIN
  -- Tables with both club_id and branch_id
  FOREACH tbl IN ARRAY ARRAY['approval_requests', 'audit_logs', 'csv_history', 'members']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'branch_id'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS branch_manager_scope_guard ON public.%I', tbl);
      EXECUTE format(
        'CREATE POLICY branch_manager_scope_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated ' ||
        'USING (NOT public.has_branch_only_role() OR public.is_club_admin(club_id) OR (branch_id IS NOT NULL AND (public.is_branch_manager(branch_id) OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id))))) ' ||
        'WITH CHECK (NOT public.has_branch_only_role() OR public.is_club_admin(club_id) OR (branch_id IS NOT NULL AND (public.is_branch_manager(branch_id) OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id)))))',
        tbl
      );
    END IF;
  END LOOP;

  -- member_roles has branch_id and member_id (links to members.club_id)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'member_roles'
      AND column_name = 'branch_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS branch_manager_scope_guard ON public.member_roles';
    EXECUTE
      'CREATE POLICY branch_manager_scope_guard ON public.member_roles AS RESTRICTIVE FOR ALL TO authenticated ' ||
      'USING (NOT public.has_branch_only_role() OR (branch_id IS NOT NULL AND (public.is_branch_manager(branch_id) OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id)))) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND public.is_club_admin(m.club_id))) ' ||
      'WITH CHECK (NOT public.has_branch_only_role() OR (branch_id IS NOT NULL AND (public.is_branch_manager(branch_id) OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id)))) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND public.is_club_admin(m.club_id)))';
  END IF;
END $$;

-- Restrictive scope guards on member-linked tables without a direct branch_id column
DROP POLICY IF EXISTS branch_manager_scope_guard ON public.guardian_relationships;
CREATE POLICY branch_manager_scope_guard
  ON public.guardian_relationships
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.has_branch_only_role()
    OR guardian_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = guardian_relationships.child_member_id
        AND (
          public.is_club_admin(m.club_id)
          OR (m.branch_id IS NOT NULL AND public.is_branch_manager(m.branch_id))
        )
    )
  )
  WITH CHECK (
    NOT public.has_branch_only_role()
    OR guardian_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = guardian_relationships.child_member_id
        AND (
          public.is_club_admin(m.club_id)
          OR (m.branch_id IS NOT NULL AND public.is_branch_manager(m.branch_id))
        )
    )
  );

DROP POLICY IF EXISTS branch_manager_scope_guard ON public.volunteer_profiles;
CREATE POLICY branch_manager_scope_guard
  ON public.volunteer_profiles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.has_branch_only_role()
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = volunteer_profiles.member_id
        AND (
          public.is_club_admin(m.club_id)
          OR (m.branch_id IS NOT NULL AND public.is_branch_manager(m.branch_id))
        )
    )
  )
  WITH CHECK (
    NOT public.has_branch_only_role()
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = volunteer_profiles.member_id
        AND (
          public.is_club_admin(m.club_id)
          OR (m.branch_id IS NOT NULL AND public.is_branch_manager(m.branch_id))
        )
    )
  );

-- Atomic transactional RPC for assigning or replacing a branch manager
CREATE OR REPLACE FUNCTION public.assign_branch_manager_atomic(
  p_club_id uuid,
  p_branch_id uuid,
  p_new_manager_id uuid,
  p_manager_email text,
  p_manager_name text,
  p_actor_id uuid,
  p_account_created boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_branch record;
  v_clean_email text;
  v_clean_name text;
BEGIN
  IF p_club_id IS NULL OR p_branch_id IS NULL OR p_new_manager_id IS NULL THEN
    RAISE EXCEPTION 'club_id, branch_id, and new_manager_id are required.';
  END IF;

  -- Lock the branch row to serialize concurrent assignments on the same branch
  SELECT id, club_id, manager_id, name
  INTO v_branch
  FROM public.club_branches
  WHERE id = p_branch_id
  FOR UPDATE;

  IF v_branch.id IS NULL OR v_branch.club_id IS DISTINCT FROM p_club_id THEN
    RAISE EXCEPTION 'Branch not found in this club.';
  END IF;

  v_clean_email := lower(btrim(COALESCE(p_manager_email, '')));
  v_clean_name := btrim(COALESCE(p_manager_name, ''));
  IF v_clean_name = '' THEN
    v_clean_name := split_part(v_clean_email, '@', 1);
  END IF;

  -- Ensure a profile exists for the assigned manager without overwriting an existing customized name or email
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (p_new_manager_id, v_clean_email, v_clean_name, 'ACTIVE')
  ON CONFLICT (id) DO UPDATE
  SET full_name = CASE
        WHEN public.profiles.full_name IS NULL
          OR btrim(public.profiles.full_name) = ''
          OR public.profiles.full_name = public.profiles.email
        THEN EXCLUDED.full_name
        ELSE public.profiles.full_name
      END,
      status = CASE
        WHEN public.profiles.status IS NULL OR public.profiles.status = 'PENDING'
        THEN 'ACTIVE'
        ELSE public.profiles.status
      END,
      updated_at = now();

  -- Revoke any previous BRANCH_MANAGER / BRANCH_CO_ADMIN role rows for this specific branch
  DELETE FROM public.user_roles
  WHERE club_id = p_club_id
    AND branch_id = p_branch_id
    AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN')
    AND user_id <> p_new_manager_id;

  -- Also clean up any legacy un-scoped BRANCH_MANAGER role row for the outgoing manager if they manage no other branch in this club
  IF v_branch.manager_id IS NOT NULL AND v_branch.manager_id <> p_new_manager_id THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_branch.manager_id
      AND club_id = p_club_id
      AND branch_id IS NULL
      AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN');
  END IF;

  -- Clean up any legacy un-scoped BRANCH_MANAGER role row for the new manager in this club before inserting the branch-scoped role
  DELETE FROM public.user_roles
  WHERE user_id = p_new_manager_id
    AND club_id = p_club_id
    AND branch_id IS NULL
    AND role = 'BRANCH_MANAGER';

  -- Grant the BRANCH_MANAGER role scoped strictly to (club_id, branch_id)
  INSERT INTO public.user_roles (user_id, role, club_id, branch_id)
  VALUES (p_new_manager_id, 'BRANCH_MANAGER', p_club_id, p_branch_id)
  ON CONFLICT (user_id, role, club_id, branch_id) DO NOTHING;

  -- Update branch manager_id
  UPDATE public.club_branches
  SET manager_id = p_new_manager_id,
      updated_at = now()
  WHERE id = p_branch_id
    AND club_id = p_club_id;

  -- Write audit log entry (never logging passwords or secrets)
  INSERT INTO public.audit_logs (
    club_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    changes
  )
  VALUES (
    p_club_id,
    p_branch_id,
    p_actor_id,
    'ASSIGN_BRANCH_MANAGER',
    'club_branches',
    p_branch_id::text,
    jsonb_build_object(
      'branch_id', p_branch_id,
      'branch_name', v_branch.name,
      'new_manager_id', p_new_manager_id,
      'previous_manager_id', v_branch.manager_id,
      'account_created', COALESCE(p_account_created, false)
    )
  );

  RETURN jsonb_build_object(
    'user_id', p_new_manager_id,
    'previous_manager_id', v_branch.manager_id,
    'branch_id', p_branch_id,
    'club_id', p_club_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_branch_manager_atomic(uuid, uuid, uuid, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_branch_manager_atomic(uuid, uuid, uuid, text, text, uuid, boolean) TO service_role;
