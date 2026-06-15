-- Corrects 20260616010000: these SECURITY DEFINER functions grant EXECUTE to
-- PUBLIC (Postgres default), so revoking from anon/authenticated alone was a
-- no-op. Revoke from PUBLIC (the real source) and grant back only where needed.
--
-- Postgres semantics relied on here:
--   * TRIGGER functions execute via the trigger mechanism regardless of the
--     invoking role's EXECUTE privilege -> safe to revoke from everyone.
--   * RLS-helper functions are evaluated as the querying role, so they need
--     EXECUTE -> intentionally NOT touched here (left granted to PUBLIC).
--   * Edge functions authenticate with the secret key (service_role), so any
--     function they call is granted to service_role as well.

-- ── Trigger functions + internal setup helper: no caller needs EXECUTE ────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_workspace_subscription_projection() from public, anon, authenticated;
revoke execute on function public.notify_on_booking_request() from public, anon, authenticated;
revoke execute on function public.notify_on_colleague_invite() from public, anon, authenticated;
revoke execute on function public.notify_on_event_insert() from public, anon, authenticated;
revoke execute on function public.notify_on_event_update() from public, anon, authenticated;
revoke execute on function public.notify_on_invoice_change() from public, anon, authenticated;
revoke execute on function public.notify_on_team_assignment() from public, anon, authenticated;
revoke execute on function public.sync_colleague_booking_response() from public, anon, authenticated;
revoke execute on function public.sync_external_colleague_status() from public, anon, authenticated;
revoke execute on function public.sync_workspace_subscription_from_tenant() from public, anon, authenticated;
revoke execute on function public.apply_starter_tenant_isolation_policies(regclass, text) from public, anon, authenticated;

-- ── Logged-in-only RPCs: drop PUBLIC (removes anon), keep authenticated + service_role ──
do $$
declare fn text;
begin
  foreach fn in array array[
    'accept_pending_workspace_invitations(uuid)',
    'can_create_workspace(uuid)',
    'create_user_workspace(uuid, text)',
    'delete_workspace(uuid)',
    'get_member_bookings(uuid)',
    'get_member_event_colleagues(uuid)',
    'get_user_tenant_id(uuid)',
    'get_user_tenants(uuid)',
    'get_user_workspace_count(uuid)',
    'get_workspace_subscription(uuid)',
    'leave_workspace(uuid)',
    'sync_tenant_from_workspace_subscription(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;
