-- 0009_global_search_and_rbac_indexes.sql
-- Optimizes Global & Scoped Search for Super Admin, Club Admin, and Branch Manager

-- 1. Trigram extension for fuzzy/fast ILIKE searches (if supported)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Indexes for Clubs Table
CREATE INDEX IF NOT EXISTS idx_clubs_name_trgm ON public.clubs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clubs_display_name_trgm ON public.clubs USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clubs_registration_no ON public.clubs(registration_no);
CREATE INDEX IF NOT EXISTS idx_clubs_state ON public.clubs(state);
CREATE INDEX IF NOT EXISTS idx_clubs_status ON public.clubs(status);

-- 3. Indexes for Club Branches Table
CREATE INDEX IF NOT EXISTS idx_club_branches_name_trgm ON public.club_branches USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_club_branches_venue_name ON public.club_branches(venue_name);
CREATE INDEX IF NOT EXISTS idx_club_branches_city_state ON public.club_branches(city, state);
CREATE INDEX IF NOT EXISTS idx_club_branches_manager_id ON public.club_branches(manager_id);

-- 4. Indexes for Profiles Table
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 5. Indexes for Parent Guardian Contacts Table
CREATE INDEX IF NOT EXISTS idx_parent_contacts_club_search ON public.parent_guardian_contacts(club_id, full_name, contact_number);

-- 6. Indexes for Volunteer Assignments
CREATE INDEX IF NOT EXISTS idx_volunteers_club_branch ON public.volunteer_assignments(club_id, branch_id, status);
