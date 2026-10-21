-- find_profile_by_email is a SECURITY DEFINER helper with no current client,
-- RLS-policy, or trigger dependency. Prevent direct signed-in Data API execution.
revoke execute on function public.find_profile_by_email(text) from authenticated;
