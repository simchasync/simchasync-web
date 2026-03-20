
-- RLS POLICIES Part 2: All remaining tables

-- CLIENTS (workspace_subscription_is_active gated)
CREATE POLICY "Internal members can view clients" ON public.clients FOR SELECT TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners and booking managers can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can update clients" ON public.clients FOR UPDATE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));

-- EVENTS
CREATE POLICY "Internal members can view events" ON public.events FOR SELECT TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners and booking managers can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can update events" ON public.events FOR UPDATE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can delete events" ON public.events FOR DELETE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));

-- EVENT_TEAM_MEMBERS
CREATE POLICY "Assigned users can view event team" ON public.event_team_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_team_members.event_id AND public.can_view_event(auth.uid(), e.id, e.tenant_id)));
CREATE POLICY "Internal members can insert event team" ON public.event_team_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_team_members.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Internal members can update event team" ON public.event_team_members FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_team_members.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Internal members can delete event team" ON public.event_team_members FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_team_members.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));

-- EVENT_ATTACHMENTS
CREATE POLICY "Assigned users can view attachments" ON public.event_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_attachments.event_id AND public.can_view_event(auth.uid(), e.id, e.tenant_id)));
CREATE POLICY "Internal members can manage attachments" ON public.event_attachments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_attachments.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Internal members can delete attachments" ON public.event_attachments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_attachments.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));

-- EVENT_PAYMENTS (owners only)
CREATE POLICY "Owners can view event payments" ON public.event_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_payments.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can insert event payments" ON public.event_payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_payments.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can update event payments" ON public.event_payments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_payments.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can delete event payments" ON public.event_payments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_payments.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));

-- EVENT_SONGS
CREATE POLICY "Assigned users can view event songs" ON public.event_songs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_songs.event_id AND public.can_view_event(auth.uid(), e.id, e.tenant_id)));
CREATE POLICY "Internal members can insert event songs" ON public.event_songs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_songs.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Internal members can update event songs" ON public.event_songs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_songs.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Internal members can delete event songs" ON public.event_songs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_songs.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));

-- EVENT_COLLEAGUES
CREATE POLICY "Internal members can view event colleagues" ON public.event_colleagues FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_colleagues.event_id AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Owners and booking managers can insert event colleagues" ON public.event_colleagues FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_colleagues.event_id AND is_tenant_member(auth.uid(), e.tenant_id) AND get_tenant_member_role(auth.uid(), e.tenant_id) = ANY(ARRAY['owner','booking_manager'])));
CREATE POLICY "Owners and booking managers can update event colleagues" ON public.event_colleagues FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_colleagues.event_id AND is_tenant_member(auth.uid(), e.tenant_id) AND get_tenant_member_role(auth.uid(), e.tenant_id) = ANY(ARRAY['owner','booking_manager'])));
CREATE POLICY "Owners and booking managers can delete event colleagues" ON public.event_colleagues FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_colleagues.event_id AND is_tenant_member(auth.uid(), e.tenant_id) AND get_tenant_member_role(auth.uid(), e.tenant_id) = ANY(ARRAY['owner','booking_manager'])));
CREATE POLICY "Assigned users can update own invite status" ON public.event_colleagues FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Assigned users can view own event colleagues" ON public.event_colleagues FOR SELECT TO authenticated USING (user_id = auth.uid());

-- EVENT_EXPENSES (owners only)
CREATE POLICY "Owners can view event expenses" ON public.event_expenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can insert event expenses" ON public.event_expenses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can update event expenses" ON public.event_expenses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can delete event expenses" ON public.event_expenses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));

-- INVOICES (owners only, workspace active)
CREATE POLICY "Owners can view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Tenant members can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- SUPPORT_TICKETS
CREATE POLICY "Users can view accessible tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_internal_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'support_agent'::public.app_role));
CREATE POLICY "Tenant members can create tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND auth.uid() = user_id);
CREATE POLICY "Ticket creators can update own tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support_agent'));

-- TICKET_REPLIES
CREATE POLICY "Users can view replies on accessible tickets" ON public.ticket_replies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_replies.ticket_id AND (st.user_id = auth.uid() OR public.is_internal_tenant_member(auth.uid(), st.tenant_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'support_agent'::public.app_role))));
CREATE POLICY "Users can create replies on accessible tickets" ON public.ticket_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_replies.ticket_id AND (st.user_id = auth.uid() OR public.is_internal_tenant_member(auth.uid(), st.tenant_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'support_agent'::public.app_role))));

-- BOOKING_REQUESTS
CREATE POLICY "Anyone can create booking requests" ON public.booking_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Internal members can view booking requests" ON public.booking_requests FOR SELECT TO authenticated USING (public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Internal members can update booking requests" ON public.booking_requests FOR UPDATE TO authenticated USING (public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Internal members can delete booking requests" ON public.booking_requests FOR DELETE TO authenticated USING (public.is_internal_tenant_member(auth.uid(), tenant_id));

-- AGENTS (workspace active)
CREATE POLICY "Internal members can view agents" ON public.agents FOR SELECT TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners can insert agents" ON public.agents FOR INSERT TO authenticated WITH CHECK (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can update agents" ON public.agents FOR UPDATE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can delete agents" ON public.agents FOR DELETE TO authenticated USING (public.workspace_subscription_is_active(tenant_id) AND public.is_tenant_member(auth.uid(), tenant_id) AND public.get_tenant_member_role(auth.uid(), tenant_id) = 'owner');

-- BOOKING_AGENTS (workspace active)
CREATE POLICY "Internal members can view booking agents" ON public.booking_agents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = booking_agents.event_id AND public.workspace_subscription_is_active(e.tenant_id) AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)));
CREATE POLICY "Owners can insert booking agents" ON public.booking_agents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = booking_agents.event_id AND public.workspace_subscription_is_active(e.tenant_id) AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can update booking agents" ON public.booking_agents FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = booking_agents.event_id AND public.workspace_subscription_is_active(e.tenant_id) AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));
CREATE POLICY "Owners can delete booking agents" ON public.booking_agents FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = booking_agents.event_id AND public.workspace_subscription_is_active(e.tenant_id) AND public.is_tenant_member(auth.uid(), e.tenant_id) AND public.get_tenant_member_role(auth.uid(), e.tenant_id) = 'owner'));

-- TENANT_LANDING_PAGES
CREATE POLICY "Anyone can view landing pages" ON public.tenant_landing_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can insert landing page" ON public.tenant_landing_pages FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can update landing page" ON public.tenant_landing_pages FOR UPDATE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');

-- TENANT_PACKAGES
CREATE POLICY "Anyone can view packages" ON public.tenant_packages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can insert packages" ON public.tenant_packages FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can update packages" ON public.tenant_packages FOR UPDATE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can delete packages" ON public.tenant_packages FOR DELETE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');

-- ADMIN_AUDIT_LOGS
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'billing_admin'::app_role) OR has_role(auth.uid(), 'support_agent'::app_role));

-- CANCELLATION_FEEDBACK
CREATE POLICY "Admins can view cancellation feedback" ON public.cancellation_feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own feedback" ON public.cancellation_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- FEATURE_REQUESTS
CREATE POLICY "Tenant members can view feature requests" ON public.feature_requests FOR SELECT TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Tenant members can create feature requests" ON public.feature_requests FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND auth.uid() = user_id);
CREATE POLICY "Admins can update feature requests" ON public.feature_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support_agent'::app_role));
CREATE POLICY "Admins can view all feature requests" ON public.feature_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support_agent'::app_role));

-- WORKSPACE_SUBSCRIPTIONS
CREATE POLICY "Admins can view all workspace subscriptions" ON public.workspace_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'support_agent'::public.app_role));
CREATE POLICY "Tenant members can view workspace subscriptions" ON public.workspace_subscriptions FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), workspace_id));

-- WORKSPACE_EXPENSES (owners only)
CREATE POLICY "Owners can view workspace expenses" ON public.workspace_expenses FOR SELECT TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can insert workspace expenses" ON public.workspace_expenses FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can update workspace expenses" ON public.workspace_expenses FOR UPDATE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');
CREATE POLICY "Owners can delete workspace expenses" ON public.workspace_expenses FOR DELETE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = 'owner');

-- COLLEAGUES
CREATE POLICY "Internal members can view colleagues" ON public.colleagues FOR SELECT TO authenticated USING (public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners and booking managers can insert colleagues" ON public.colleagues FOR INSERT TO authenticated WITH CHECK (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can update colleagues" ON public.colleagues FOR UPDATE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));
CREATE POLICY "Owners and booking managers can delete colleagues" ON public.colleagues FOR DELETE TO authenticated USING (is_tenant_member(auth.uid(), tenant_id) AND get_tenant_member_role(auth.uid(), tenant_id) = ANY(ARRAY['owner','booking_manager']));

-- STORAGE POLICIES
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Tenant members can upload event files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-files');
CREATE POLICY "Anyone can view event files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'event-files');
CREATE POLICY "Tenant members can delete event files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-files');
