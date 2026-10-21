-- 0007_club_display_name.sql
-- Add display_name column to public.clubs with 30-character constraint and audit support

-- 1. Add display_name column
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(30);

-- 2. Add validation constraint: max 30 chars, non-empty when not null
ALTER TABLE public.clubs 
DROP CONSTRAINT IF EXISTS check_club_display_name_length;

ALTER TABLE public.clubs 
ADD CONSTRAINT check_club_display_name_length 
CHECK (display_name IS NULL OR (length(trim(display_name)) > 0 AND length(display_name) <= 30));

-- 3. Populate existing clubs safely
-- For "Senshi Goju-Ryu Karate-Do Academy", explicitly set to "Senshi Goju-Ryu" (15 chars)
UPDATE public.clubs 
SET display_name = 'Senshi Goju-Ryu'
WHERE name = 'Senshi Goju-Ryu Karate-Do Academy' AND (display_name IS NULL OR display_name = '');

-- For all other clubs with name <= 30 chars
UPDATE public.clubs 
SET display_name = trim(name)
WHERE (display_name IS NULL OR display_name = '') AND length(trim(name)) <= 30;

-- For any remaining clubs > 30 chars, shorten to 30 chars safely
UPDATE public.clubs 
SET display_name = substring(trim(name) from 1 for 30)
WHERE (display_name IS NULL OR display_name = '') AND length(trim(name)) > 30;

-- 4. Update handle_new_user trigger to handle display_name on registration
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_club_id UUID;
  v_club_name TEXT;
  v_display_name VARCHAR(30);
BEGIN
  -- Insert the user profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');

  v_club_name := new.raw_user_meta_data->>'club_name';
  v_display_name := new.raw_user_meta_data->>'display_name';

  -- If display_name is not provided, fall back to shortening club_name up to 30 chars
  IF v_display_name IS NULL OR trim(v_display_name) = '' THEN
    IF v_club_name IS NOT NULL THEN
      v_display_name := substring(trim(v_club_name) from 1 for 30);
    END IF;
  ELSE
    v_display_name := substring(trim(v_display_name) from 1 for 30);
  END IF;

  -- If club_name is provided, this is a new club signup
  IF v_club_name IS NOT NULL AND v_club_name != '' THEN
    -- Create the new club with display_name
    INSERT INTO public.clubs (name, display_name, primary_admin_id, status)
    VALUES (v_club_name, v_display_name, new.id, 'Active')
    RETURNING id INTO v_club_id;

    -- Assign CLUB_ADMIN role to the new user for this club
    INSERT INTO public.user_roles (user_id, role, club_id, granted_at)
    VALUES (new.id, 'CLUB_ADMIN', v_club_id, NOW());
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies on public.clubs
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view clubs
DROP POLICY IF EXISTS "Anyone authenticated can view active clubs" ON public.clubs;
CREATE POLICY "Anyone authenticated can view active clubs" 
    ON public.clubs FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- Superadmin and Club Admins can update their own club
DROP POLICY IF EXISTS "Admins can update their club" ON public.clubs;
CREATE POLICY "Admins can update their club" 
    ON public.clubs FOR UPDATE 
    USING (is_superadmin() OR is_club_admin(id))
    WITH CHECK (is_superadmin() OR is_club_admin(id));
