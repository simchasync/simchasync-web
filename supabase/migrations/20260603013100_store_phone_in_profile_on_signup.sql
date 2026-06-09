-- Store phone number in profiles table on signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE new_tenant_id uuid; user_name text; user_slug text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  user_slug := LOWER(REPLACE(REPLACE(user_name, ' ', '-'), '@', '-')) || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);
  INSERT INTO public.profiles (user_id, full_name, email, phone, has_used_trial)
  VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'phone', false);
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
