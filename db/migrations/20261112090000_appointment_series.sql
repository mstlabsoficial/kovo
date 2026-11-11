-- KOVO · 20261112090000 · Appointment series (repeated appointments).
--
-- A series is a set of appointments created together ("every week", "every two weeks"). They share
-- `series_id`, chosen by the client so that a retried creation can be recognised. No extra table:
--   * creation is one bulk INSERT (one statement → all or nothing; an overlap in any date rejects
--     the whole series with 23P01);
--   * "cancel this and the following" is one UPDATE filtered by series_id and start time.
-- RLS, the overlap exclusion constraint, audit and reminder triggers apply to each row as usual.
-- Additive and nullable: existing rows and clients that do not send it are unaffected.

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS series_id uuid;

CREATE INDEX IF NOT EXISTS appointments_series_idx
  ON public.appointments (org_id, series_id, starts_at)
  WHERE series_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.series_id IS
  'Appointments created together as a repeated series share this id (chosen by the client). NULL = single appointment.';
