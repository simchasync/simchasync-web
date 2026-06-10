-- The "Venue Type" feature was removed; drop the column if it was ever
-- created (the prior add-column migration was never applied to the live DB,
-- but this is idempotent in case it was added manually).
ALTER TABLE public.events
  DROP COLUMN IF EXISTS venue_type;
