-- Tighten storage RLS on the `event-files` bucket.
-- Files are stored as `{event_id}/{uuid}.{ext}`, so the first path segment is
-- the event id. Previously SELECT was public (anyone could LIST every file)
-- and INSERT/DELETE only checked bucket_id (any authenticated user could
-- upload to / DELETE any other tenant's files).
--
-- These policies delegate to the SAME helper functions the `event_attachments`
-- TABLE policies use, so file access exactly matches attachment-row access:
--   SELECT       -> public.can_view_event(uid, event_id, tenant_id)
--   INSERT/DELETE-> public.is_internal_tenant_member(uid, tenant_id)
-- `e.id::text = (storage.foldername(name))[1]` compares text-to-text, so stray
-- objects with a non-uuid first segment can't raise an invalid-uuid cast error.
--
-- NOTE: `event-files` stays a PUBLIC bucket, so existing getPublicUrl() links
-- keep working for object download (public buckets serve objects by name
-- without RLS). Removing the broad SELECT only stops API listing/enumeration.
-- If event files should be private long-term, make the bucket private and
-- switch the app to createSignedUrl() — tracked as a follow-up, not here.

DROP POLICY IF EXISTS "Anyone can view event files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload event files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can delete event files" ON storage.objects;

CREATE POLICY "Tenant members can view event files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-files'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND public.can_view_event(auth.uid(), e.id, e.tenant_id)
  )
);

CREATE POLICY "Tenant members can upload event files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-files'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)
  )
);

CREATE POLICY "Tenant members can delete event files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-files'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND public.is_internal_tenant_member(auth.uid(), e.tenant_id)
  )
);
