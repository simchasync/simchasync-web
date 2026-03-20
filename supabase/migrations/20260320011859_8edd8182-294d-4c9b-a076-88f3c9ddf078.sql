-- Fix 1: Prevent invited users from escalating their role on self-acceptance
DROP POLICY IF EXISTS "Owners can insert tenant members" ON public.tenant_members;

CREATE POLICY "Owners can insert tenant members"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Branch 1: Existing owners can insert anyone
  (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'::public.tenant_role
      AND tm.invitation_status = 'accepted'::public.tenant_invitation_status
  ))
  OR
  -- Branch 2: Self-acceptance of pending invite — role MUST match the invited role
  (
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
    AND role = (
      SELECT ei.role FROM public.tenant_members ei
      WHERE ei.tenant_id = tenant_members.tenant_id
        AND ei.invitation_status = 'invited'::public.tenant_invitation_status
        AND ei.invitation_email = (
          SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
        )
      LIMIT 1
    )
  )
);

-- Fix 2: Restrict workspace_subscriptions SELECT to internal members only
DROP POLICY IF EXISTS "Tenant members can view workspace subscriptions" ON public.workspace_subscriptions;

CREATE POLICY "Internal members can view workspace subscriptions"
ON public.workspace_subscriptions
FOR SELECT
TO authenticated
USING (
  public.is_internal_tenant_member(auth.uid(), workspace_id)
);