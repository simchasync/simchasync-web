-- Tracks each SMS sent via the send-sms edge function, so it can enforce a
-- per-tenant daily cap (a compromised owner could otherwise bulk-text their
-- own contacts on our Twilio bill). Written only by the edge function via
-- the service-role key, which bypasses RLS.

CREATE TABLE public.sms_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  to_number  TEXT        NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_log_tenant_sent_at_idx ON public.sms_log (tenant_id, sent_at);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_log FORCE ROW LEVEL SECURITY;

-- Owners/booking managers can see their own tenant's send history
CREATE POLICY sms_log_select ON public.sms_log
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND public.get_tenant_member_role(auth.uid(), tenant_id) = ANY (
      ARRAY['owner', 'booking_manager']
    )
  );
