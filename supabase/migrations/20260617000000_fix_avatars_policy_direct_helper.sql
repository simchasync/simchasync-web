-- Fix logo/hero upload ("new row violates row-level security policy").
--
-- The avatars bucket holds profile avatars at `{user_id}/…` and tenant
-- logo/hero at `{tenant_id}/…`. The previous tenant branch authorized via
--   EXISTS (SELECT 1 FROM public.tenants t WHERE t.id::text = <path>
--           AND public.is_internal_tenant_member(auth.uid(), t.id))
-- which reads `tenants` under the caller's RLS — coupling the upload to the
-- tenants-table policies, and failing in the Storage RLS context for
-- legitimate owners (profile-avatar upload, which only checks auth.uid(),
-- worked — proving auth is fine; only the tenant branch failed).
--
-- Fix: call the SECURITY DEFINER helper public.is_internal_tenant_member
-- DIRECTLY on the path's first segment (it checks tenant_members internally
-- and bypasses RLS — the same helper event_attachments policies use). A UUID
-- shape guard prevents an invalid-uuid cast on stray object names.
-- Bucket stays public so getPublicUrl() logos keep rendering.

DROP POLICY IF EXISTS "Avatar owners and tenant members can view" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners and tenant members can upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners and tenant members can update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners and tenant members can delete" ON storage.objects;

CREATE POLICY "Avatar owners and tenant members can view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_internal_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_internal_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_internal_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_internal_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Avatar owners and tenant members can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_internal_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);
