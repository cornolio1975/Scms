-- 0004_rpc_functions.sql
-- Adds utility functions for secure queries that need to bypass RLS safely

CREATE OR REPLACE FUNCTION public.find_profile_by_email(search_email TEXT)
RETURNS TABLE (id UUID, email TEXT, full_name TEXT) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- We only allow searching by exact email to prevent scraping
  RETURN QUERY
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE p.email = search_email
  LIMIT 1;
END;
$$;
