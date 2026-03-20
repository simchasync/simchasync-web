
-- =====================================================
-- RLS POLICIES - Part 1: profiles, tenants, tenant_members, user_roles
-- =====================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Internal users can view coworker profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members tm_target WHERE tm_target.user_id = profiles.user_id AND public.is_internal_tenant_member(auth.uid(), tm_target.tenant_id)));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'billing_admin') OR has_role(auth.uid(), 'support_agent'));

-- TENANTS
CREATE POLICY "Internal users can view their tenant" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_internal_tenant_member(auth.uid(), id));
CREATE POLICY "Owners can update their tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_members.tenant_id = tenants.id AND tenant_members.user_id = auth.uid() AND tenant_members.role = 'owner'::tenant_role));
CREATE POLICY "Admins can view all tenants" ON public.tenants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'billing_admin') OR has_role(auth.uid(), 'support_agent'));
CREATE POLICY "Admins can update all tenants" ON public.tenants FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'billing_admin'));

-- TENANT_MEMBERS
CREATE POLICY "Users can view own or internal tenant members" ON public.tenant_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_internal_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners can insert tenant members" ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::public.tenant_role AND tm.invitation_status = 'accepted'::public.tenant_invitation_status)) OR auth.uid() = user_id);
CREATE POLICY "Owners can update tenant members" ON public.tenant_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::public.tenant_role AND tm.invitation_status = 'accepted'::public.tenant_invitation_status))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::public.tenant_role AND tm.invitation_status = 'accepted'::public.tenant_invitation_status));
CREATE POLICY "Owners can delete tenant members or users can leave" ON public.tenant_members FOR DELETE TO authenticated
  USING ((EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::public.tenant_role AND tm.invitation_status = 'accepted'::public.tenant_invitation_status)) OR (auth.uid() = user_id AND role <> 'owner'::public.tenant_role));
CREATE POLICY "Admins can view all tenant members" ON public.tenant_members FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'billing_admin') OR has_role(auth.uid(), 'support_agent'));

-- USER_ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
