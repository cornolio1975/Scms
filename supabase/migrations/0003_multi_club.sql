-- 0003_multi_club.sql
-- Updates the user signup trigger to automatically create a club and assign CLUB_ADMIN role

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_club_id UUID;
  v_club_name TEXT;
BEGIN
  -- Insert the user profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');

  -- Extract club name from metadata (provided during signup)
  -- WARNING: The presence of `club_name` in raw_user_meta_data is the strict invariant 
  -- that signals this is an intentional "New Club Registration" flow. 
  -- DO NOT add `club_name` to other signup flows (e.g. Google OAuth or general member invites) 
  -- as doing so will unintentionally elevate those users to CLUB_ADMIN and create ghost clubs.
  v_club_name := new.raw_user_meta_data->>'club_name';

  -- If club_name is provided, this is a new club signup
  IF v_club_name IS NOT NULL AND v_club_name != '' THEN
    -- Create the new club
    INSERT INTO public.clubs (name, primary_admin_id, status)
    VALUES (v_club_name, new.id, 'Active')
    RETURNING id INTO v_club_id;

    -- Assign CLUB_ADMIN role to the new user for this club
    INSERT INTO public.user_roles (user_id, role, club_id, granted_at)
    VALUES (new.id, 'CLUB_ADMIN', v_club_id, NOW());
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
