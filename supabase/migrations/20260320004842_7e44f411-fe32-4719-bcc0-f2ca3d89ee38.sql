
-- TRIGGERS
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_sync_ws_lock_state ON public.workspace_subscriptions;
CREATE TRIGGER trg_sync_ws_lock_state BEFORE INSERT OR UPDATE ON public.workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_subscription_lock_state();

DROP TRIGGER IF EXISTS trg_ws_sub_projection ON public.workspace_subscriptions;
CREATE TRIGGER trg_ws_sub_projection AFTER INSERT OR UPDATE OR DELETE ON public.workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_subscription_projection();

DROP TRIGGER IF EXISTS trg_tenant_to_ws_sub ON public.tenants;
CREATE TRIGGER trg_tenant_to_ws_sub AFTER INSERT OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_subscription_from_tenant();

DROP TRIGGER IF EXISTS trg_ws_sub_updated_at ON public.workspace_subscriptions;
CREATE TRIGGER trg_ws_sub_updated_at BEFORE UPDATE ON public.workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_subscription_updated_at();

CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_colleagues_updated_at BEFORE UPDATE ON public.colleagues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tenant_landing_pages_updated_at BEFORE UPDATE ON public.tenant_landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tenant_packages_updated_at BEFORE UPDATE ON public.tenant_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_workspace_expenses_updated_at BEFORE UPDATE ON public.workspace_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_notify_booking_request AFTER INSERT ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking_request();
CREATE OR REPLACE TRIGGER trg_notify_event_insert AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_insert();
CREATE OR REPLACE TRIGGER trg_notify_event_update AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_update();
CREATE OR REPLACE TRIGGER trg_notify_invoice AFTER INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.notify_on_invoice_change();
CREATE OR REPLACE TRIGGER trg_notify_team_assign AFTER INSERT ON public.event_team_members FOR EACH ROW EXECUTE FUNCTION public.notify_on_team_assignment();
CREATE OR REPLACE TRIGGER on_colleague_invite AFTER INSERT ON public.event_colleagues FOR EACH ROW EXECUTE FUNCTION public.notify_on_colleague_invite();
CREATE OR REPLACE TRIGGER on_external_booking_request_status_change AFTER UPDATE OF status ON public.booking_requests FOR EACH ROW WHEN (NEW.source_colleague_id IS NOT NULL) EXECUTE FUNCTION public.sync_external_colleague_status();

-- REALTIME
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_team_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_colleagues; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_colleagues_user_id ON public.colleagues (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_colleagues_user_id ON public.event_colleagues (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_colleagues_event_user_id ON public.event_colleagues (event_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_status ON public.tenant_members(user_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status ON public.tenant_members(tenant_id, invitation_status);
CREATE UNIQUE INDEX IF NOT EXISTS event_colleagues_unique_assignment ON public.event_colleagues (event_id, colleague_id) WHERE colleague_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_normalized_email_unique_idx ON public.clients (tenant_id, lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';
CREATE INDEX IF NOT EXISTS clients_tenant_normalized_phone_idx ON public.clients (tenant_id, regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) WHERE phone IS NOT NULL AND trim(phone) <> '';
CREATE INDEX IF NOT EXISTS clients_tenant_normalized_name_idx ON public.clients (tenant_id, lower(trim(name)));
