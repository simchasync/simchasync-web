-- =====================================================
-- Seed Data: Tenants and App Configuration
-- =====================================================
-- This seed file initializes test data for development
-- Profiles are created by the TypeScript seed script (npm run seed)

BEGIN;

-- =====================================================
-- 1. SEED TENANTS
-- =====================================================
INSERT INTO public.tenants (id, name, slug, plan, trial_ends_at, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, 'Demo Tenant', 'demo-tenant', 'trial', now() + interval '30 days', now(), now()),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'Premium Client', 'premium-client', 'pro', now() + interval '365 days', now(), now()),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'Startup Co', 'startup-co', 'starter', now() + interval '365 days', now(), now())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. VERIFY SEED DATA
-- =====================================================
SELECT 'Tenants' as entity, count(*) as count FROM public.tenants;

COMMIT;

