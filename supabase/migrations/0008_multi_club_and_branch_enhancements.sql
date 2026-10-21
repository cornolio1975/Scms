-- 0008_multi_club_and_branch_enhancements.sql
-- Production Upgrade: Multi-Club, Branch Management, Performance Indexes & Approval Status

-- 1. Add district, internal_notes, approval_status to public.clubs
ALTER TABLE public.clubs 
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'APPROVED';

-- 2. Add district, display_name to public.club_branches
ALTER TABLE public.club_branches 
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);

-- 3. Add performance indexes for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_club_branches_club_id ON public.club_branches(club_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_club_branch ON public.user_roles(club_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_approval_requests_club ON public.approval_requests(club_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_club_created ON public.audit_logs(club_id, created_at DESC);

-- 4. Update approval_status for existing clubs based on status
UPDATE public.clubs 
SET approval_status = CASE 
  WHEN status = 'Active' THEN 'APPROVED'
  WHEN status = 'Pending Approval' OR status = 'Submitted' THEN 'PENDING'
  WHEN status = 'Suspended' THEN 'SUSPENDED'
  WHEN status = 'Rejected' THEN 'REJECTED'
  ELSE 'APPROVED'
END
WHERE approval_status IS NULL OR approval_status = 'APPROVED';
