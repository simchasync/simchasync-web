
-- =====================================================
-- BATCH 1: Core schema - Types, Tables, Functions
-- =====================================================

-- Tenant / workspace table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  avatar_url TEXT,
  has_used_trial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant role enum
DO $$ BEGIN
  CREATE TYPE public.tenant_role AS ENUM ('owner', 'booking_manager', 'social_media_manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invitation status enum
DO $$ BEGIN
  CREATE TYPE public.tenant_invitation_status AS ENUM ('invited', 'accepted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant members
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  invitation_status public.tenant_invitation_status NOT NULL DEFAULT 'accepted',
  invitation_email text,
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  invited_by uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- App-level admin roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'support_agent', 'billing_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment status enum
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  hebrew_date TEXT,
  venue TEXT,
  location TEXT,
  event_type TEXT NOT NULL DEFAULT 'wedding',
  notes TEXT,
  total_price NUMERIC(12,2) DEFAULT 0,
  deposit NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  chuppah_time time,
  meal_time time,
  first_dance_time time,
  second_dance_time time,
  mitzvah_tanz_time time,
  event_start_time time,
  travel_fee numeric DEFAULT 0,
  deposit_status text NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraint for deposit_status
DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_deposit_status_check CHECK (deposit_status IN ('paid', 'unpaid'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event team members
CREATE TABLE IF NOT EXISTS public.event_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  role TEXT,
  cost NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  invitation_status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event attachments
CREATE TABLE IF NOT EXISTS public.event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice status enum
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  overtime numeric DEFAULT 0,
  stripe_payment_id TEXT,
  stripe_payment_url TEXT,
  description text DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event payments
CREATE TABLE IF NOT EXISTS public.event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'cash',
  notes text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event songs
CREATE TABLE IF NOT EXISTS public.event_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  segment text NOT NULL DEFAULT 'chuppah',
  song_title text NOT NULL,
  artist text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Colleagues
CREATE TABLE IF NOT EXISTS public.colleagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_instrument text,
  phone text,
  email text,
  notes text,
  default_price numeric DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Event colleagues
CREATE TABLE IF NOT EXISTS public.event_colleagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  colleague_id uuid REFERENCES public.colleagues(id) ON DELETE SET NULL,
  name text,
  role_instrument text,
  phone text,
  email text,
  notes text,
  price numeric DEFAULT 0,
  payment_responsibility text NOT NULL DEFAULT 'paid_by_me',
  user_id uuid,
  colleague_type text NOT NULL DEFAULT 'internal',
  invite_status text NOT NULL DEFAULT 'auto_assigned',
  booking_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event expenses
CREATE TABLE IF NOT EXISTS public.event_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  expense_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Booking requests
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  event_type TEXT DEFAULT 'wedding',
  event_date DATE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  price numeric NULL DEFAULT NULL,
  source_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  source_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  source_colleague_id uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK for event_colleagues.booking_request_id after booking_requests exists
DO $$ BEGIN
  ALTER TABLE public.event_colleagues
    ADD CONSTRAINT event_colleagues_booking_request_id_fkey
    FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add FK for booking_requests.source_colleague_id
DO $$ BEGIN
  ALTER TABLE public.booking_requests
    ADD CONSTRAINT booking_requests_source_colleague_id_fkey
    FOREIGN KEY (source_colleague_id) REFERENCES public.event_colleagues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Support tickets
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ticket replies
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin audit logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_tenant_id uuid,
  target_user_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cancellation feedback
CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  tenant_name text,
  plan text,
  reason text NOT NULL,
  details text,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant landing pages
CREATE TABLE IF NOT EXISTS public.tenant_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  tagline TEXT DEFAULT '',
  about TEXT DEFAULT '',
  logo_url TEXT,
  hero_image_url TEXT,
  services_description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant packages
CREATE TABLE IF NOT EXISTS public.tenant_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price TEXT DEFAULT '',
  features TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agents
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  commission_rate numeric NOT NULL DEFAULT 10,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Booking agents
CREATE TABLE IF NOT EXISTS public.booking_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  commission_rate numeric NOT NULL DEFAULT 10,
  commission_amount numeric DEFAULT 0,
  commission_paid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, agent_id)
);

-- Feature requests
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'under_review',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Workspace expenses
CREATE TABLE IF NOT EXISTS public.workspace_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add extra columns to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS calendar_token TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS payment_instructions text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_price_cents integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_plan_price_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_mrr_cents integer DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_primary_workspace boolean NOT NULL DEFAULT false;

-- Workspace subscriptions
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  current_period_end TIMESTAMP WITH TIME ZONE,
  workspace_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  features_locked boolean NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT workspace_subscriptions_workspace_id_key UNIQUE (workspace_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_status ON public.tenant_members(user_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status ON public.tenant_members(tenant_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_colleagues_user_id ON public.colleagues (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_colleagues_user_id ON public.event_colleagues (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_colleagues_event_user_id ON public.event_colleagues (event_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_colleagues_unique_assignment ON public.event_colleagues (event_id, colleague_id) WHERE colleague_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_normalized_email_unique_idx ON public.clients (tenant_id, lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';
CREATE INDEX IF NOT EXISTS clients_tenant_normalized_phone_idx ON public.clients (tenant_id, regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) WHERE phone IS NOT NULL AND trim(phone) <> '';
CREATE INDEX IF NOT EXISTS clients_tenant_normalized_name_idx ON public.clients (tenant_id, lower(trim(name)));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-files', 'event-files', true) ON CONFLICT (id) DO NOTHING;
