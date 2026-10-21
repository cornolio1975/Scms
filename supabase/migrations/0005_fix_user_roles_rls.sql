-- Allow users to view their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
    ON public.user_roles FOR SELECT 
    USING (auth.uid() = user_id);
