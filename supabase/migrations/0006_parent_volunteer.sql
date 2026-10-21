-- 0006_parent_volunteer.sql
-- Implements Parent/Guardian Contacts and Volunteer Management Portal

-- A. Parent/Guardian Contacts
CREATE TABLE IF NOT EXISTS public.parent_guardian_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    email TEXT,
    volunteer_preference BOOLEAN DEFAULT FALSE,
    volunteer_eligibility_status TEXT DEFAULT 'Eligible',
    volunteer_communication_consent_status TEXT,
    volunteer_communication_consent_timestamp TIMESTAMPTZ,
    volunteer_interests TEXT,
    availability_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. Athlete–Guardian Relationships
CREATE TABLE IF NOT EXISTS public.athlete_guardian_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    guardian_contact_id UUID REFERENCES public.parent_guardian_contacts(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (athlete_member_id, guardian_contact_id)
);

-- C. Volunteer Assignments
CREATE TABLE IF NOT EXISTS public.volunteer_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.club_branches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_date DATE,
    start_time TIME,
    end_time TIME,
    location TEXT,
    general_duty TEXT,
    required_volunteers INT DEFAULT 1,
    instructions TEXT,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Draft', 'Open', 'Assigned', 'Completed', 'Cancelled')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- D. Volunteer Assignment Members
CREATE TABLE IF NOT EXISTS public.volunteer_assignment_members (
    assignment_id UUID REFERENCES public.volunteer_assignments(id) ON DELETE CASCADE,
    guardian_contact_id UUID REFERENCES public.parent_guardian_contacts(id) ON DELETE CASCADE,
    individual_duty TEXT,
    status TEXT DEFAULT 'Pending Confirmation' CHECK (status IN ('Pending Confirmation', 'Confirmed', 'Declined', 'Completed', 'Cancelled')),
    attendance_status TEXT,
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    PRIMARY KEY (assignment_id, guardian_contact_id)
);

-- Enable RLS
ALTER TABLE public.parent_guardian_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_guardian_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_assignment_members ENABLE ROW LEVEL SECURITY;

-- Helper Functions
-- (Assuming is_superadmin, is_club_admin, is_branch_manager are already available from 0002_rbac_and_approvals.sql)

-- RLS Policies for parent_guardian_contacts
CREATE POLICY "Admins can manage club contacts" 
    ON public.parent_guardian_contacts FOR ALL 
    USING (is_superadmin() OR is_club_admin(club_id));

-- RLS Policies for athlete_guardian_relationships
CREATE POLICY "Admins can manage relationships" 
    ON public.athlete_guardian_relationships FOR ALL 
    USING (is_superadmin() OR EXISTS (
        SELECT 1 FROM public.parent_guardian_contacts pgc 
        WHERE pgc.id = guardian_contact_id AND is_club_admin(pgc.club_id)
    ));

-- RLS Policies for volunteer_assignments
CREATE POLICY "Admins can manage assignments" 
    ON public.volunteer_assignments FOR ALL 
    USING (is_superadmin() OR is_club_admin(club_id));

-- RLS Policies for volunteer_assignment_members
CREATE POLICY "Admins can manage assignment members" 
    ON public.volunteer_assignment_members FOR ALL 
    USING (is_superadmin() OR EXISTS (
        SELECT 1 FROM public.volunteer_assignments va 
        WHERE va.id = assignment_id AND is_club_admin(va.club_id)
    ));
