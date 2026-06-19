-- Google Calendar OAuth integration (one-way push, per-user, per-workspace).
-- Two edge-function-only tables holding OAuth tokens + event->Google mappings.

-- Per-user, per-workspace Google connection (holds OAuth tokens).
CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  google_email text,
  refresh_token text,
  access_token text,
  token_expiry timestamptz,
  status text NOT NULL DEFAULT 'active',
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, provider)
);

-- Maps a SimchaSync event to its pushed Google event, per connected user.
CREATE TABLE IF NOT EXISTS public.event_calendar_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  last_synced timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_calendar_sync ENABLE ROW LEVEL SECURITY;

-- Both tables are edge-function-only: the service key bypasses RLS, and no
-- policies are granted to `authenticated`, so the browser can never read the
-- OAuth tokens. Clients read connection status through the RPC below instead.
REVOKE ALL ON public.user_calendar_connections FROM anon, authenticated;
REVOKE ALL ON public.event_calendar_sync FROM anon, authenticated;

-- Status-only view of the caller's connection (never returns tokens).
CREATE OR REPLACE FUNCTION public.get_my_calendar_connection(_tenant_id uuid)
RETURNS TABLE (connected boolean, google_email text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS connected,
    c.google_email,
    c.status
  FROM public.user_calendar_connections c
  WHERE c.user_id = auth.uid()
    AND c.tenant_id = _tenant_id
    AND c.provider = 'google'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_calendar_connection(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_calendar_connection(uuid) TO authenticated;
