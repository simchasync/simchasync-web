-- travel_fee_type controls how a travel fee is treated:
--   'expense'         → deducted from profit (owner bears the cost)
--   'charge_customer' → added to the customer's invoice (billed as revenue)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS travel_fee_type text NOT NULL DEFAULT 'expense';