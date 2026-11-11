-- KOVO · 20261112090500 · Concurrent bookings of the same professional end in a clean conflict.
--
-- appointments_no_professional_overlap (GiST exclusion, propuesta 20261108) already makes overlaps
-- impossible. But when several transactions insert overlapping rows at the same instant, PostgreSQL
-- can detect a deadlock between them (40P01) before the exclusion check reports 23P01: the losers
-- then get a generic error instead of «ese horario se solapa». Found running the concurrency suite
-- against a fresh stack (8 simultaneous bookings: 1 accepted, 7 × 40P01).
--
-- Fix: active bookings of one professional take a transaction-scoped advisory lock first, so they
-- are checked one after another. The waiting transaction then sees the committed row and gets the
-- normal 23P01. Different professionals never wait for each other. No data or rule changes.

CREATE OR REPLACE FUNCTION private.serialize_professional_booking()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF new.professional_id IS NOT NULL AND new.status IN ('scheduled', 'confirmed') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kovo.booking:' || new.org_id::text || ':' || new.professional_id::text, 0));
  END IF;
  RETURN new;
END; $function$;
REVOKE ALL ON FUNCTION private.serialize_professional_booking() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER appointments_serialize_booking
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, professional_id, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.serialize_professional_booking();
