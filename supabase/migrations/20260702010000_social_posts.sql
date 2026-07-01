-- Social Media post planner table.
-- Allows owners, booking managers, and social media managers to manage posts.

CREATE TABLE public.social_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform     TEXT        NOT NULL DEFAULT 'instagram',
  caption      TEXT,
  hashtags     TEXT,
  status       TEXT        NOT NULL DEFAULT 'draft', -- draft | scheduled | posted
  scheduled_date DATE,
  posted_at    TIMESTAMPTZ,
  event_id     UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts FORCE ROW LEVEL SECURITY;

-- All tenant members can read posts
CREATE POLICY social_posts_select ON public.social_posts
  FOR SELECT TO authenticated
  USING (public.is_internal_tenant_member(auth.uid(), tenant_id));

-- Owners, booking managers, and social media managers can write posts
CREATE POLICY social_posts_insert ON public.social_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY (
      ARRAY['owner', 'booking_manager', 'social_media_manager']
    )
  );

CREATE POLICY social_posts_update ON public.social_posts
  FOR UPDATE TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY (
      ARRAY['owner', 'booking_manager', 'social_media_manager']
    )
  )
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY (
      ARRAY['owner', 'booking_manager', 'social_media_manager']
    )
  );

CREATE POLICY social_posts_delete ON public.social_posts
  FOR DELETE TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY (
      ARRAY['owner', 'booking_manager', 'social_media_manager']
    )
  );
