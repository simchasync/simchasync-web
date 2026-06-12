-- When a colleague accepts/declines an incoming cross-workspace booking
-- request (booking_requests.status -> 'booked'/'declined'), reflect it on the
-- source workspace's event_colleagues row and notify the source owner(s).
-- SECURITY DEFINER: the responder has no RLS access to the source tenant.

CREATE OR REPLACE FUNCTION public.sync_colleague_booking_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colleague_name text;
  v_event_type text;
  v_event_date date;
BEGIN
  IF NEW.source_colleague_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('booked', 'declined') THEN

    UPDATE public.event_colleagues ec
    SET invite_status = CASE WHEN NEW.status = 'booked' THEN 'accepted' ELSE 'rejected' END
    WHERE ec.id = NEW.source_colleague_id
    RETURNING ec.name INTO v_colleague_name;

    SELECT e.event_type, e.event_date INTO v_event_type, v_event_date
    FROM public.event_colleagues ec
    JOIN public.events e ON e.id = ec.event_id
    WHERE ec.id = NEW.source_colleague_id;

    IF NEW.source_tenant_id IS NOT NULL THEN
      INSERT INTO public.notifications (tenant_id, user_id, title, message, type, link)
      SELECT
        NEW.source_tenant_id,
        tm.user_id,
        CASE WHEN NEW.status = 'booked'
          THEN 'Colleague accepted your booking request'
          ELSE 'Colleague declined your booking request'
        END,
        COALESCE(v_colleague_name, 'A colleague')
          || CASE WHEN NEW.status = 'booked' THEN ' accepted' ELSE ' declined' END
          || ' your request for '
          || COALESCE(v_event_type, 'an event')
          || COALESCE(' on ' || v_event_date::text, ''),
        'booking',
        '/app/bookings'
      FROM public.tenant_members tm
      WHERE tm.tenant_id = NEW.source_tenant_id
        AND tm.role = 'owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_colleague_booking_response ON public.booking_requests;
CREATE TRIGGER trg_sync_colleague_booking_response
AFTER UPDATE OF status ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_colleague_booking_response();
