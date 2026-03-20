
-- =====================================================
-- LIFECYCLE FUNCTIONS
-- =====================================================

-- Accept pending invitations
CREATE OR REPLACE FUNCTION public.accept_pending_workspace_invitations(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _accepted_count integer;
BEGIN
  UPDATE public.tenant_members tm
  SET invitation_status = 'accepted'::public.tenant_invitation_status,
      accepted_at = COALESCE(tm.accepted_at, now()),
      invitation_email = COALESCE(tm.invitation_email, (SELECT p.email FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1))
  WHERE tm.user_id = _user_id AND tm.invitation_status = 'invited'::public.tenant_invitation_status;
  GET DIAGNOSTICS _accepted_count = ROW_COUNT;
  RETURN _accepted_count;
END;
$$;

-- Leave workspace
CREATE OR REPLACE FUNCTION public.leave_workspace(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _role public.tenant_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT tm.role INTO _role FROM public.tenant_members tm WHERE tm.tenant_id = _tenant_id AND tm.user_id = auth.uid() LIMIT 1;
  IF _role IS NULL THEN RAISE EXCEPTION 'Workspace membership not found'; END IF;
  IF _role = 'owner'::public.tenant_role THEN RAISE EXCEPTION 'Owners cannot leave their workspace'; END IF;
  DELETE FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = auth.uid();
END;
$$;

-- Delete workspace (blocks primary)
CREATE OR REPLACE FUNCTION public.delete_workspace(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = _tenant_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::public.tenant_role AND tm.invitation_status = 'accepted'::public.tenant_invitation_status) THEN
    RAISE EXCEPTION 'Only workspace admins can delete a workspace';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = _tenant_id AND t.is_primary_workspace = true) THEN
    RAISE EXCEPTION 'The main workspace cannot be deleted.';
  END IF;
  DELETE FROM public.event_attachments WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.event_colleagues WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.event_expenses WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.event_payments WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.event_songs WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.event_team_members WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.ticket_replies WHERE ticket_id IN (SELECT st.id FROM public.support_tickets st WHERE st.tenant_id = _tenant_id);
  DELETE FROM public.workspace_subscriptions WHERE workspace_id = _tenant_id;
  DELETE FROM public.invoices WHERE tenant_id = _tenant_id;
  DELETE FROM public.notifications WHERE tenant_id = _tenant_id;
  DELETE FROM public.support_tickets WHERE tenant_id = _tenant_id;
  DELETE FROM public.booking_requests WHERE tenant_id = _tenant_id;
  DELETE FROM public.booking_agents WHERE event_id IN (SELECT e.id FROM public.events e WHERE e.tenant_id = _tenant_id);
  DELETE FROM public.agents WHERE tenant_id = _tenant_id;
  DELETE FROM public.tenant_landing_pages WHERE tenant_id = _tenant_id;
  DELETE FROM public.tenant_packages WHERE tenant_id = _tenant_id;
  DELETE FROM public.colleagues WHERE tenant_id = _tenant_id;
  DELETE FROM public.clients WHERE tenant_id = _tenant_id;
  DELETE FROM public.events WHERE tenant_id = _tenant_id;
  DELETE FROM public.cancellation_feedback WHERE tenant_id = _tenant_id;
  DELETE FROM public.feature_requests WHERE tenant_id = _tenant_id;
  DELETE FROM public.workspace_expenses WHERE tenant_id = _tenant_id;
  DELETE FROM public.tenant_members WHERE tenant_id = _tenant_id;
  DELETE FROM public.tenants WHERE id = _tenant_id;
END;
$$;

-- Create user workspace (secondary, inactive)
CREATE OR REPLACE FUNCTION public.create_user_workspace(_user_id uuid, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE new_tenant_id uuid; safe_slug text;
BEGIN
  safe_slug := LOWER(REGEXP_REPLACE(REPLACE(_name, ' ', '-'), '[^a-z0-9\-]', '', 'g')) || '-' || SUBSTRING(_user_id::TEXT, 1, 8);
  INSERT INTO public.tenants (name, slug, plan, stripe_subscription_status, is_primary_workspace)
  VALUES (_name, safe_slug, 'none', 'inactive', false)
  RETURNING id INTO new_tenant_id;
  INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES (new_tenant_id, _user_id, 'owner');
  INSERT INTO public.workspace_subscriptions (workspace_id, user_id, plan_id, subscription_status, workspace_limits, features_locked)
  VALUES (new_tenant_id, _user_id, NULL, 'inactive', public.compute_workspace_limits('none'), true)
  ON CONFLICT (workspace_id) DO UPDATE SET user_id = EXCLUDED.user_id, plan_id = EXCLUDED.plan_id, subscription_status = EXCLUDED.subscription_status, workspace_limits = EXCLUDED.workspace_limits, features_locked = EXCLUDED.features_locked, updated_at = now();
  RETURN new_tenant_id;
END;
$$;

-- Handle new user (signup trigger): trial workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE new_tenant_id uuid; user_name text; user_slug text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  user_slug := LOWER(REPLACE(REPLACE(user_name, ' ', '-'), '@', '-')) || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);
  INSERT INTO public.profiles (user_id, full_name, email, has_used_trial) VALUES (NEW.id, user_name, NEW.email, false);
  INSERT INTO public.tenants (name, slug, plan, stripe_subscription_status, is_primary_workspace, trial_ends_at)
  VALUES (user_name || '''s Workspace', user_slug, 'trial', 'trial', true, now() + interval '30 days')
  RETURNING id INTO new_tenant_id;
  INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES (new_tenant_id, NEW.id, 'owner');
  INSERT INTO public.workspace_subscriptions (workspace_id, user_id, plan_id, subscription_status, workspace_limits, features_locked)
  VALUES (new_tenant_id, NEW.id, 'trial', 'trial', public.compute_workspace_limits('trial'), false)
  ON CONFLICT (workspace_id) DO UPDATE SET user_id = EXCLUDED.user_id, plan_id = EXCLUDED.plan_id, subscription_status = EXCLUDED.subscription_status, workspace_limits = EXCLUDED.workspace_limits, features_locked = EXCLUDED.features_locked, updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- SYNC FUNCTIONS (bidirectional tenant <-> workspace_subscriptions)
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_workspace_subscription_lock_state()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  NEW.features_locked := COALESCE(NEW.subscription_status, 'inactive') NOT IN ('active', 'trial');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_workspace_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_from_workspace_subscription(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _subscription RECORD;
BEGIN
  SELECT * INTO _subscription FROM public.workspace_subscriptions WHERE workspace_id = _workspace_id LIMIT 1;
  IF _subscription IS NULL THEN
    UPDATE public.tenants SET plan = 'none', stripe_customer_id = NULL, stripe_subscription_id = NULL, stripe_subscription_status = 'inactive', stripe_plan_price_id = NULL, stripe_current_period_end = NULL, stripe_mrr_cents = 0, is_manual_override = false, last_synced_at = now(), updated_at = now() WHERE id = _workspace_id;
    RETURN;
  END IF;
  UPDATE public.tenants SET
    plan = COALESCE(_subscription.plan_id, 'none'),
    stripe_customer_id = _subscription.stripe_customer_id,
    stripe_subscription_id = _subscription.stripe_subscription_id,
    stripe_subscription_status = COALESCE(_subscription.subscription_status, 'inactive'),
    stripe_plan_price_id = CASE WHEN _subscription.plan_id = 'lite' THEN 'price_1TAb41GgnW7qov4TpKHgrKOO' WHEN _subscription.plan_id = 'full' THEN 'price_1T7OlrRfOygaToU0wmN7SP2j' ELSE NULL END,
    stripe_current_period_end = _subscription.current_period_end,
    stripe_mrr_cents = CASE WHEN _subscription.plan_id = 'lite' THEN 5999 WHEN _subscription.plan_id = 'full' THEN 8999 ELSE 0 END,
    is_manual_override = _subscription.is_manual_override,
    last_synced_at = now(), updated_at = now()
  WHERE id = _workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_workspace_subscription_projection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_tenant_from_workspace_subscription(OLD.workspace_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_tenant_from_workspace_subscription(NEW.workspace_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_workspace_subscription_from_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _owner_user_id uuid; _derived_status text; _derived_plan text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  SELECT tm.user_id INTO _owner_user_id FROM public.tenant_members tm WHERE tm.tenant_id = NEW.id AND tm.role = 'owner'::public.tenant_role ORDER BY tm.created_at LIMIT 1;
  _derived_plan := NULLIF(COALESCE(NULLIF(NEW.plan, ''), 'none'), 'none');
  _derived_status := COALESCE(NULLIF(NEW.stripe_subscription_status, ''), CASE WHEN NEW.plan = 'trial' THEN 'trial' WHEN NEW.plan = 'none' THEN 'inactive' ELSE 'active' END);
  INSERT INTO public.workspace_subscriptions (workspace_id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, subscription_status, current_period_end, workspace_limits, is_manual_override, features_locked)
  VALUES (NEW.id, _owner_user_id, NEW.stripe_customer_id, NEW.stripe_subscription_id, _derived_plan, _derived_status, NEW.stripe_current_period_end, public.compute_workspace_limits(COALESCE(NULLIF(NEW.plan, ''), 'none')), NEW.is_manual_override, _derived_status NOT IN ('active', 'trial'))
  ON CONFLICT (workspace_id) DO UPDATE SET user_id = EXCLUDED.user_id, stripe_customer_id = EXCLUDED.stripe_customer_id, stripe_subscription_id = EXCLUDED.stripe_subscription_id, plan_id = EXCLUDED.plan_id, subscription_status = EXCLUDED.subscription_status, current_period_end = EXCLUDED.current_period_end, workspace_limits = EXCLUDED.workspace_limits, is_manual_override = EXCLUDED.is_manual_override, features_locked = EXCLUDED.features_locked, updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- NOTIFICATION FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_on_event_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _member RECORD; _client_name TEXT;
BEGIN
  SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
  FOR _member IN SELECT user_id FROM public.tenant_members WHERE tenant_id = NEW.tenant_id LOOP
    INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
    VALUES (NEW.tenant_id, _member.user_id, 'New Booking Created', 'New ' || COALESCE(NEW.event_type, 'event') || ' on ' || NEW.event_date::text || COALESCE(' for ' || _client_name, ''), 'booking', '/app/bookings');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_event_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _member RECORD;
BEGIN
  IF OLD.event_date IS DISTINCT FROM NEW.event_date OR OLD.venue IS DISTINCT FROM NEW.venue OR OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    FOR _member IN SELECT user_id FROM public.tenant_members WHERE tenant_id = NEW.tenant_id LOOP
      INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
      VALUES (NEW.tenant_id, _member.user_id, 'Booking Updated', 'Event on ' || NEW.event_date::text || ' has been updated', 'booking', '/app/bookings');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_invoice_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _member RECORD; _title TEXT; _message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN _title := 'Invoice Created'; _message := 'New invoice for $' || NEW.amount::text;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status WHEN 'sent' THEN _title := 'Invoice Sent'; _message := 'Invoice for $' || NEW.amount::text || ' has been sent';
      WHEN 'paid' THEN _title := 'Payment Received'; _message := 'Invoice for $' || NEW.amount::text || ' has been paid';
      WHEN 'overdue' THEN _title := 'Invoice Overdue'; _message := 'Invoice for $' || NEW.amount::text || ' is overdue';
      ELSE RETURN NEW; END CASE;
  ELSE RETURN NEW; END IF;
  FOR _member IN SELECT user_id FROM public.tenant_members WHERE tenant_id = NEW.tenant_id LOOP
    INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link) VALUES (NEW.tenant_id, _member.user_id, _title, _message, 'payment', '/app/invoices');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_team_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _event RECORD;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT tenant_id, event_date, event_type INTO _event FROM public.events WHERE id = NEW.event_id;
    INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
    VALUES (_event.tenant_id, NEW.user_id, 'Booking Assignment', 'You have been assigned as ' || COALESCE(NEW.role, 'teammate') || ' for ' || _event.event_type || ' on ' || _event.event_date::text, 'booking', '/app/bookings');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_booking_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _member RECORD;
BEGIN
  FOR _member IN SELECT user_id FROM public.tenant_members WHERE tenant_id = NEW.tenant_id AND role IN ('owner', 'booking_manager') AND invitation_status = 'accepted' LOOP
    INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
    VALUES (NEW.tenant_id, _member.user_id, 'New Booking Request', 'New request from ' || NEW.name || COALESCE(' for ' || NEW.event_type, ''), 'booking', '/app/bookings');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_colleague_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _event RECORD;
BEGIN
  IF NEW.colleague_type = 'external_collaborator' OR NEW.colleague_type = 'external' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT NULL AND NEW.invite_status = 'pending' THEN
    SELECT tenant_id, event_date, event_type INTO _event FROM public.events WHERE id = NEW.event_id;
    INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
    VALUES (_event.tenant_id, NEW.user_id, 'Booking Invitation', 'You have been invited as ' || COALESCE(NEW.role_instrument, 'colleague') || ' for ' || _event.event_type || ' on ' || _event.event_date::text, 'booking', '/app/bookings');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_external_colleague_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.source_colleague_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'booked' THEN UPDATE public.event_colleagues SET invite_status = 'accepted' WHERE id = NEW.source_colleague_id;
    ELSIF NEW.status = 'declined' THEN UPDATE public.event_colleagues SET invite_status = 'rejected' WHERE id = NEW.source_colleague_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Member-facing RPCs
CREATE OR REPLACE FUNCTION public.get_member_bookings(_tenant_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, event_date date, event_type text, hebrew_date text, venue text, location text, notes text, chuppah_time time, meal_time time, first_dance_time time, second_dance_time time, mitzvah_tanz_time time, event_start_time time, created_at timestamptz, updated_at timestamptz, client_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.tenant_id, e.event_date, e.event_type, e.hebrew_date, e.venue, e.location, e.notes, e.chuppah_time, e.meal_time, e.first_dance_time, e.second_dance_time, e.mitzvah_tanz_time, e.event_start_time, e.created_at, e.updated_at, c.name AS client_name
  FROM public.events e LEFT JOIN public.clients c ON c.id = e.client_id
  WHERE e.tenant_id = _tenant_id AND public.can_view_event(auth.uid(), e.id, e.tenant_id)
  ORDER BY e.event_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_member_event_colleagues(_event_id uuid)
RETURNS TABLE (id uuid, event_id uuid, colleague_id uuid, name text, role_instrument text, phone text, email text, notes text, created_at timestamp with time zone, colleague_type text, invite_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ec.id, ec.event_id, ec.colleague_id, ec.name, ec.role_instrument, ec.phone, ec.email, ec.notes, ec.created_at, ec.colleague_type, ec.invite_status
  FROM public.event_colleagues ec JOIN public.events e ON e.id = ec.event_id
  WHERE ec.event_id = _event_id AND public.can_view_event(auth.uid(), e.id, e.tenant_id)
  ORDER BY ec.created_at;
$$;
