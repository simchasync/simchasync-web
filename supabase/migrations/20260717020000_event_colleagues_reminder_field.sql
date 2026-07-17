-- Tracks whether a "haven't responded yet" reminder has already been sent
-- for an internal colleague's pending booking invite, so it only fires once.

ALTER TABLE public.event_colleagues
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS event_colleagues_pending_reminder_idx
  ON public.event_colleagues (invite_status, created_at)
  WHERE invite_status = 'pending' AND reminder_sent_at IS NULL;
