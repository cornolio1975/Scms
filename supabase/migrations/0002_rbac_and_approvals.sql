-- 0002_rbac_and_approvals.sql
-- Implements strict multi-tenant RLS and Approval Workflows for SCMS

-- 1. Create Approval Requests Table
CREATE TABLE IF NOT EXISTS public.approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.club_branches(id) ON DELETE CASCADE,
    requested_role user_role_type NOT NULL,
    status TEXT DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- 2. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.club_branches(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.club_branches(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Advanced Row Level Security Policies

-- Helper function to check if current user is SUPERADMIN
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'SUPERADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is CLUB_ADMIN for a specific club
CREATE OR REPLACE FUNCTION is_club_admin(check_club_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role = 'CLUB_ADMIN' 
      AND club_id = check_club_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is BRANCH_MANAGER for a specific branch
CREATE OR REPLACE FUNCTION is_branch_manager(check_branch_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role = 'BRANCH_MANAGER' 
      AND branch_id = check_branch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CLUB_BRANCHES RLS
-- Club Admins can INSERT/UPDATE/DELETE branches in their own club
DROP POLICY IF EXISTS "Club Admins can manage their branches" ON public.club_branches;
CREATE POLICY "Club Admins can manage their branches" 
    ON public.club_branches FOR ALL 
    USING (is_superadmin() OR is_club_admin(club_id));

-- Branch Managers can VIEW their own branch
DROP POLICY IF EXISTS "Branch Managers can view assigned branch" ON public.club_branches;
CREATE POLICY "Branch Managers can view assigned branch" 
    ON public.club_branches FOR SELECT 
    USING (is_branch_manager(id));

-- USER_ROLES RLS
-- Club Admins can view/assign roles within their club ONLY.
DROP POLICY IF EXISTS "Club Admins can manage club roles" ON public.user_roles;
CREATE POLICY "Club Admins can manage club roles" 
    ON public.user_roles FOR ALL 
    USING (is_superadmin() OR (is_club_admin(club_id) AND role != 'SUPERADMIN' AND role != 'CLUB_ADMIN'));

-- APPROVAL_REQUESTS RLS
-- Users can see their own requests
DROP POLICY IF EXISTS "Users can view own requests" ON public.approval_requests;
CREATE POLICY "Users can view own requests" 
    ON public.approval_requests FOR SELECT 
    USING (auth.uid() = user_id);

-- Club Admins can manage requests for their club
DROP POLICY IF EXISTS "Club Admins manage requests" ON public.approval_requests;
CREATE POLICY "Club Admins manage requests" 
    ON public.approval_requests FOR ALL 
    USING (is_superadmin() OR is_club_admin(club_id));

-- AUDIT_LOGS RLS
-- Only SuperAdmin and Club Admin can read logs (Club Admin scoped to their club)
DROP POLICY IF EXISTS "Admins can view logs" ON public.audit_logs;
CREATE POLICY "Admins can view logs" 
    ON public.audit_logs FOR SELECT 
    USING (is_superadmin() OR is_club_admin(club_id));
