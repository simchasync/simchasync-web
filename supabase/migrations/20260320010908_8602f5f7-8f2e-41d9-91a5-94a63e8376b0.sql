
-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Owners can insert tenant members" ON public.tenant_members;

-- Create a fixed INSERT policy:
-- 1. Existing owners of the tenant can add members (same as before)
-- 2. Self-insertion is ONLY allowed when a pending invitation already exists for the user's email
CREATE POLICY "Owners can insert tenant members" ON public.tenant_members
FOR INSERT TO authenticated
WITH CHECK (
  (
    -- Existing owners can add members
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'::public.tenant_role
        AND tm.invitation_status = 'accepted'::public.tenant_invitation_status
    )
  )
  OR
  (
    -- Self-insertion only for accepting a pending invitation that matches the user's email
    auth.uid() = user_id
    AND invitation_status = 'accepted'::public.tenant_invitation_status
    AND EXISTS (
      SELECT 1 FROM public.tenant_members existing_invite
      WHERE existing_invite.tenant_id = tenant_members.tenant_id
        AND existing_invite.invitation_status = 'invited'::public.tenant_invitation_status
        AND existing_invite.invitation_email = (
          SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
        )
    )
  )
);
