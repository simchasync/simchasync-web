-- Adds inquiry-tracking fields to booking_requests for the Customer Inquiries
-- board: whether the row came from the public form or was logged by hand,
-- and an optional follow-up reminder date.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_reminded_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.booking_requests
    ADD CONSTRAINT booking_requests_source_check CHECK (source IN ('web', 'manual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS booking_requests_follow_up_date_idx
  ON public.booking_requests (tenant_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;
