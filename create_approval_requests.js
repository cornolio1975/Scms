const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  const query = `
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

CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'SUPERADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own requests' AND tablename = 'approval_requests') THEN
    CREATE POLICY "Users can view own requests" 
        ON public.approval_requests FOR SELECT 
        USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Club Admins manage requests' AND tablename = 'approval_requests') THEN
    CREATE POLICY "Club Admins manage requests" 
        ON public.approval_requests FOR ALL 
        USING (is_superadmin() OR is_club_admin(club_id));
  END IF;
END
$$;
  `;
  
  try {
    await pgClient.query(query);
    console.log('approval_requests and functions created.');
  } catch(e) {
    console.log('Error:', e);
  }
  
  await pgClient.end();
}
run();
