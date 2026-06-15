-- Reduce the attack surface of SECURITY DEFINER functions (Supabase advisor:
-- *_security_definer_function_executable). These run with elevated privileges,
-- so anon/authenticated should only keep EXECUTE where genuinely needed.
--
-- Categories:
--   * TRIGGER functions     -> fire as part of the table operation, never called
--                              by a role directly. Revoke from anon + authenticated.
--   * internal setup helper -> apply_starter_tenant_isolation_policies (not client
--                              callable). Revoke from anon + authenticated.
--   * logged-in-only RPCs    -> workspace/membership management. Revoke from anon
--                              (keep authenticated — the app calls these).
--   * KEPT as-is             -> RLS helper functions referenced in policies
--                              (can_view_event, is_tenant_member, is_internal_tenant_member,
--                              get_tenant_member_role, has_role, workspace_subscription_is_active)
--                              and get_tenant_by_slug (called by the public /book page as anon).

-- ── Trigger functions: no role needs EXECUTE ──────────────────────────────────
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_workspace_subscription_projection() from anon, authenticated;
revoke execute on function public.notify_on_booking_request() from anon, authenticated;
revoke execute on function public.notify_on_colleague_invite() from anon, authenticated;
revoke execute on function public.notify_on_event_insert() from anon, authenticated;
revoke execute on function public.notify_on_event_update() from anon, authenticated;
revoke execute on function public.notify_on_invoice_change() from anon, authenticated;
revoke execute on function public.notify_on_team_assignment() from anon, authenticated;
revoke execute on function public.sync_colleague_booking_response() from anon, authenticated;
revoke execute on function public.sync_external_colleague_status() from anon, authenticated;
revoke execute on function public.sync_workspace_subscription_from_tenant() from anon, authenticated;

-- ── Internal setup helper: not client-callable ───────────────────────────────
revoke execute on function public.apply_starter_tenant_isolation_policies(regclass, text) from anon, authenticated;

-- ── Logged-in-only RPCs: anon never needs these ──────────────────────────────
revoke execute on function public.accept_pending_workspace_invitations(uuid) from anon;
revoke execute on function public.can_create_workspace(uuid) from anon;
revoke execute on function public.create_user_workspace(uuid, text) from anon;
revoke execute on function public.delete_workspace(uuid) from anon;
revoke execute on function public.get_member_bookings(uuid) from anon;
revoke execute on function public.get_member_event_colleagues(uuid) from anon;
revoke execute on function public.get_user_tenant_id(uuid) from anon;
revoke execute on function public.get_user_tenants(uuid) from anon;
revoke execute on function public.get_user_workspace_count(uuid) from anon;
revoke execute on function public.get_workspace_subscription(uuid) from anon;
revoke execute on function public.leave_workspace(uuid) from anon;
revoke execute on function public.sync_tenant_from_workspace_subscription(uuid) from anon;
