ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS approval_email_status text
    CHECK (approval_email_status IN ('PENDING', 'SENT')),
  ADD COLUMN IF NOT EXISTS approval_email_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.review_club_registration(
  registration_id uuid, reviewer_id uuid, decision text
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  registration public.approval_requests%ROWTYPE;
  club public.clubs%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = reviewer_id AND role::text IN ('SUPERADMIN', 'SYSTEM_ADMIN')
  ) THEN
    RETURN 'FORBIDDEN';
  END IF;

  SELECT * INTO registration FROM public.approval_requests
  WHERE id = registration_id AND requested_role = 'CLUB_ADMIN' AND branch_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  SELECT * INTO club FROM public.clubs WHERE id = registration.club_id FOR UPDATE;
  IF NOT FOUND OR club.primary_admin_id IS DISTINCT FROM registration.user_id THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF decision = 'SEND_EMAIL' THEN
    IF registration.status = 'APPROVED' AND club.status = 'Active' THEN
      RETURN COALESCE(registration.approval_email_status, 'CONFLICT');
    END IF;
    RETURN 'CONFLICT';
  END IF;

  IF registration.status = 'APPROVED' AND decision = 'APPROVE' AND club.status = 'Active' THEN
    RETURN COALESCE(registration.approval_email_status, 'CONFLICT');
  END IF;

  IF registration.status <> 'PENDING_APPROVAL' OR club.status <> 'PENDING_APPROVAL' THEN
    RETURN 'CONFLICT';
  END IF;

  IF decision = 'APPROVE' THEN
    UPDATE public.clubs SET status = 'Active', approval_status = 'APPROVED' WHERE id = club.id;
    UPDATE public.profiles SET status = 'ACTIVE' WHERE id = registration.user_id;
    INSERT INTO public.user_roles (user_id, club_id, role)
    SELECT registration.user_id, club.id, 'CLUB_ADMIN'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = registration.user_id AND club_id = club.id
        AND role = 'CLUB_ADMIN' AND branch_id IS NULL
    );
    UPDATE public.approval_requests
    SET status = 'APPROVED', reviewed_by = reviewer_id, reviewed_at = now(),
        approval_email_status = 'PENDING'
    WHERE id = registration.id;
    RETURN 'PENDING';
  ELSIF decision = 'REJECT' THEN
    UPDATE public.clubs SET status = 'REJECTED', approval_status = 'REJECTED' WHERE id = club.id;
    UPDATE public.profiles SET status = 'INACTIVE' WHERE id = registration.user_id;
    UPDATE public.approval_requests
    SET status = 'REJECTED', reviewed_by = reviewer_id, reviewed_at = now()
    WHERE id = registration.id;
    RETURN 'REJECTED';
  END IF;

  RETURN 'CONFLICT';
END;
$$;

REVOKE ALL ON FUNCTION public.review_club_registration(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_club_registration(uuid, uuid, text) TO service_role;
