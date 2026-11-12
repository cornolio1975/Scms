-- Restrictive policies intersect existing permissive policies. They cannot grant access.
-- Managers without club/global administration must supply an assigned branch for
-- every read/write on branch-bearing public tables, including finance/attendance.
DO $guard$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'branch_id'
      AND t.table_type = 'BASE TABLE' AND c.data_type = 'uuid'
      AND c.table_name <> 'user_roles'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.table_name);
    EXECUTE format('DROP POLICY IF EXISTS branch_manager_scope_guard ON public.%I', target.table_name);
    EXECUTE format($policy$
      CREATE POLICY branch_manager_scope_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (
        NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN'))
        OR public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id))
        OR public.is_branch_manager(branch_id)
      )
      WITH CHECK (
        NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN'))
        OR public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.club_branches b WHERE b.id = branch_id AND public.is_club_admin(b.club_id))
        OR public.is_branch_manager(branch_id)
      )
    $policy$, target.table_name);
  END LOOP;
END;
$guard$;

DROP POLICY IF EXISTS branch_manager_scope_guard ON public.club_branches;
CREATE POLICY branch_manager_scope_guard ON public.club_branches AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN'))
  OR public.is_superadmin() OR public.is_club_admin(club_id) OR public.is_branch_manager(id)
)
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('BRANCH_MANAGER', 'BRANCH_CO_ADMIN'))
  OR public.is_superadmin() OR public.is_club_admin(club_id) OR public.is_branch_manager(id)
);
