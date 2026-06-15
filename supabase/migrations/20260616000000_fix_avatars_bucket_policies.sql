-- Fix the `avatars` bucket policies. The bucket holds two kinds of objects:
--   * profile avatars  -> `{user_id}/avatar.ext`   (SettingsPage)
--   * tenant logo/hero -> `{tenant_id}/{type}.ext`  (LandingPageEditor)
-- The previous write policies only allowed `foldername[1] = auth.uid()`, so
-- tenant logo/hero uploads (folder = tenant_id, not user_id) were REJECTED by
-- RLS — logo/hero upload was effectively broken. SELECT was also `public`,
-- allowing anyone to LIST every object (security advisor finding).
--
-- New rules (bucket stays PUBLIC, so getPublicUrl() links keep serving objects
-- to anonymous visitors on the public booking page — only API listing changes):
--   * Write/list allowed when the first path segment is the caller's own
--     user id, OR it is a tenant the caller is an internal member of
--     (reusing public.is_internal_tenant_member, same helper used elsewhere).
--   * Tenant lookup is done by text match (`t.id::text = segment`) so a
--     non-uuid / foreign segment can never raise an invalid-uuid cast error.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Avatar owners and tenant members can view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND public.is_internal_tenant_member(auth.uid(), t.id)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND public.is_internal_tenant_member(auth.uid(), t.id)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND public.is_internal_tenant_member(auth.uid(), t.id)
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND public.is_internal_tenant_member(auth.uid(), t.id)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND public.is_internal_tenant_member(auth.uid(), t.id)
    )
  )
);
