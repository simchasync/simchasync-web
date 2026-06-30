ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS auto_generate_invoices boolean NOT NULL DEFAULT true;
