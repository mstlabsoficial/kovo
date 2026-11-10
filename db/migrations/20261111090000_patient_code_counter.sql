-- KOVO · 20261111090000 · Patient code counter without collisions.
--
-- Problem (found in T2D, real E2E): private.assign_patient_code() only consumed the counter for
-- NULL / '' / 'AUTO' codes. A patient imported or created with an explicit code ('P-00001')
-- did not advance private.org_counters, so the next automatic code collided with it (23505 on
-- patients_org_id_patient_code_key).
--
-- Fix:
--   * an explicit code with KOVO's format (P-<digits>) raises the counter to at least that number;
--   * an automatic code skips any value that already exists (defence in depth for legacy data);
--   * the same synchronisation runs when a code is changed with UPDATE;
--   * existing organizations are synchronised once (max P-number per org).
-- The UNIQUE (org_id, patient_code) constraint stays as the final authority. Concurrency: every
-- path takes the org_counters row lock (INSERT … ON CONFLICT DO UPDATE), so two simultaneous
-- inserts in one organization are serialised on the counter.

CREATE OR REPLACE FUNCTION private.assign_patient_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v bigint;
  n bigint;
BEGIN
  IF NEW.patient_code IS NULL OR btrim(NEW.patient_code) = '' OR NEW.patient_code = 'AUTO' THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'A patient code cannot be cleared' USING ERRCODE = '23514';
    END IF;
    LOOP
      INSERT INTO private.org_counters(org_id, counter_type, last_value)
      VALUES (NEW.org_id, 'patient', 1)
      ON CONFLICT (org_id, counter_type) DO UPDATE
        SET last_value = private.org_counters.last_value + 1
      RETURNING last_value INTO v;
      NEW.patient_code := 'P-' || lpad(v::text, 5, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.org_id = NEW.org_id AND p.patient_code = NEW.patient_code
      );
    END LOOP;
  ELSE
    NEW.patient_code := btrim(NEW.patient_code);
    IF NEW.patient_code ~ '^P-[0-9]{1,15}$' THEN
      n := substr(NEW.patient_code, 3)::bigint;
      INSERT INTO private.org_counters(org_id, counter_type, last_value)
      VALUES (NEW.org_id, 'patient', n)
      ON CONFLICT (org_id, counter_type) DO UPDATE
        SET last_value = greatest(private.org_counters.last_value, EXCLUDED.last_value);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.assign_patient_code() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS patients_assign_code_on_update ON public.patients;
CREATE TRIGGER patients_assign_code_on_update
  BEFORE UPDATE OF patient_code ON public.patients
  FOR EACH ROW WHEN (NEW.patient_code IS DISTINCT FROM OLD.patient_code)
  EXECUTE FUNCTION private.assign_patient_code();

-- One-off synchronisation of organizations that already hold explicit codes.
INSERT INTO private.org_counters(org_id, counter_type, last_value)
SELECT org_id, 'patient', max(substr(patient_code, 3)::bigint)
FROM public.patients
WHERE patient_code ~ '^P-[0-9]{1,15}$'
GROUP BY org_id
ON CONFLICT (org_id, counter_type) DO UPDATE
  SET last_value = greatest(private.org_counters.last_value, EXCLUDED.last_value);
