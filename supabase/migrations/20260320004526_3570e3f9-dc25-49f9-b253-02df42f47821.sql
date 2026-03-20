
-- =====================================================
-- CORE FUNCTIONS
-- =====================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Security definer: role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Security definer: tenant membership (accepted only)
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND invitation_status = 'accepted'::public.tenant_invitation_status
  )
$$;

-- Security definer: internal tenant member (owner/booking_manager/social_media_manager, accepted)
CREATE OR REPLACE FUNCTION public.is_internal_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND invitation_status = 'accepted'::public.tenant_invitation_status
      AND role IN ('owner'::tenant_role, 'booking_manager'::tenant_role, 'social_media_manager'::tenant_role)
  )
$$;

-- Get tenant member role (accepted only)
CREATE OR REPLACE FUNCTION public.get_tenant_member_role(_user_id uuid, _tenant_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.tenant_members
  WHERE user_id = _user_id AND tenant_id = _tenant_id
    AND invitation_status = 'accepted'::public.tenant_invitation_status
  LIMIT 1
$$;

-- Get user's primary tenant_id (accepted only)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = _user_id
    AND invitation_status = 'accepted'::public.tenant_invitation_status
  ORDER BY created_at LIMIT 1
$$;

-- Get all user tenants (for workspace switcher)
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS TABLE(tenant_id uuid, tenant_name text, tenant_slug text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT tm.tenant_id, t.name, t.slug, tm.role::text
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = _user_id
    AND tm.invitation_status = 'accepted'::public.tenant_invitation_status
  ORDER BY tm.created_at
$$;

-- Get tenant by slug (public lookup)
CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.slug FROM public.tenants t WHERE t.slug = _slug LIMIT 1
$$;

-- Can view event (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.can_view_event(_user_id uuid, _event_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_tenant_member(_user_id, _tenant_id)
    AND (
      is_internal_tenant_member(_user_id, _tenant_id)
      OR (
        get_tenant_member_role(_user_id, _tenant_id) = 'member'
        AND (
          EXISTS (SELECT 1 FROM public.event_colleagues ec
            WHERE ec.event_id = _event_id
              AND (ec.user_id = _user_id
                OR EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.user_id = _user_id AND p.email IS NOT NULL
                    AND ec.email IS NOT NULL AND lower(p.email) = lower(ec.email))))
          OR EXISTS (SELECT 1 FROM public.event_team_members etm
            WHERE etm.event_id = _event_id AND etm.user_id = _user_id)
        )
      )
    )
$$;

-- Compute workspace limits
CREATE OR REPLACE FUNCTION public.compute_workspace_limits(_plan_id text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  RETURN CASE lower(coalesce(_plan_id, 'trial'))
    WHEN 'full' THEN jsonb_build_object('maxWorkspaces', 999, 'features', jsonb_build_array('stripe_connect', 'social_media', 'expenses_profit'))
    WHEN 'lite' THEN jsonb_build_object('maxWorkspaces', 2, 'features', jsonb_build_array('stripe_connect'))
    WHEN 'none' THEN jsonb_build_object('maxWorkspaces', 0, 'features', jsonb_build_array())
    ELSE jsonb_build_object('maxWorkspaces', 1, 'features', jsonb_build_array('stripe_connect', 'social_media', 'expenses_profit'))
  END;
END;
$$;

-- Workspace subscription helpers
CREATE OR REPLACE FUNCTION public.get_workspace_subscription(_workspace_id uuid)
RETURNS TABLE(workspace_id uuid, user_id uuid, stripe_customer_id text, stripe_subscription_id text, plan_id text, subscription_status text, current_period_end timestamp with time zone, workspace_limits jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ws.workspace_id, ws.user_id, ws.stripe_customer_id, ws.stripe_subscription_id, ws.plan_id, ws.subscription_status, ws.current_period_end, ws.workspace_limits
  FROM public.workspace_subscriptions ws WHERE ws.workspace_id = _workspace_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.workspace_subscription_is_active(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_subscriptions ws
    JOIN public.tenants t ON t.id = ws.workspace_id
    WHERE ws.workspace_id = _workspace_id
      AND (ws.subscription_status = 'active' OR (ws.subscription_status = 'trial' AND t.trial_ends_at > now()))
      AND COALESCE(ws.plan_id, 'none') <> 'none'
      AND COALESCE(ws.features_locked, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_count(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.tenant_members tm
  WHERE tm.user_id = _user_id AND tm.role = 'owner'::public.tenant_role
    AND tm.invitation_status = 'accepted'::public.tenant_invitation_status
$$;

CREATE OR REPLACE FUNCTION public.can_create_workspace(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id);
$$;
