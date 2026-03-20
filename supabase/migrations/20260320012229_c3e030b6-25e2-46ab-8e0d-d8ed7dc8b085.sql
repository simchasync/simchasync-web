-- Fix 1: Restrict profiles UPDATE to prevent email spoofing
-- Users can update their profile but email must match their auth.users email
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    email IS NULL
    OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
  )
);

-- Fix 2: Restrict event_colleagues UPDATE to prevent event_id reassignment
DROP POLICY IF EXISTS "Assigned users can update own invite status" ON public.event_colleagues;

CREATE POLICY "Assigned users can update own invite status"
ON public.event_colleagues
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND event_id = (SELECT ec.event_id FROM public.event_colleagues ec WHERE ec.id = event_colleagues.id)
);