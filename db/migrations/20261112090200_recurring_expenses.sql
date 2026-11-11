-- KOVO · 20261112090200 · Recurring monthly expenses (interfaz v3, Facturación › Gastos fijos).
--
--   * recurring_expenses: the configured expense (rent, phone…). Psychologists manage them;
--     accounting reads them (same readers as public.expenses).
--   * public.apply_recurring_expenses(org): records the months that are due up to today (Madrid) as
--     ordinary rows of public.expenses, tagged with recurring_id + recurring_month. A unique index
--     makes it idempotent: two tabs or two people calling it at once never duplicate a month.
--   * Deleting a generated expense remembers that month as skipped (trigger), so it is not
--     recreated. Deleting or pausing the recurring expense keeps what was already recorded.
-- The amounts are the clinic's own figures (base, VAT %, retention %); KOVO does not decide fiscal
-- criteria (docs/fiscal). public.expenses still stores only the total.

CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (length(category) BETWEEN 1 AND 100),
  supplier text CHECK (supplier IS NULL OR length(supplier) <= 200),
  day_of_month smallint NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  base_cents integer NOT NULL CHECK (base_cents > 0 AND base_cents <= 100000000),
  vat_pct numeric(5,2) NOT NULL DEFAULT 21 CHECK (vat_pct BETWEEN 0 AND 100),
  retention_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (retention_pct BETWEEN 0 AND 100),
  deductible_pct numeric(5,2) CHECK (deductible_pct IS NULL OR deductible_pct BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  since_month date NOT NULL DEFAULT date_trunc('month', (now() AT TIME ZONE 'Europe/Madrid'))::date CHECK (extract(day FROM since_month) = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);
CREATE INDEX recurring_expenses_org_idx ON public.recurring_expenses (org_id);

CREATE TABLE public.recurring_expense_skips (
  org_id uuid NOT NULL,
  recurring_id uuid NOT NULL,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recurring_id, month),
  FOREIGN KEY (org_id, recurring_id) REFERENCES public.recurring_expenses(org_id, id) ON DELETE CASCADE
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurring_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_month date;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_recurring_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  ADD CONSTRAINT expenses_recurring_month_check CHECK (recurring_id IS NULL OR recurring_month IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_month_uq ON public.expenses (org_id, recurring_id, recurring_month) WHERE recurring_id IS NOT NULL;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_skips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recurring_expenses, public.recurring_expense_skips FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT SELECT ON public.recurring_expense_skips TO authenticated;
GRANT ALL ON public.recurring_expenses, public.recurring_expense_skips TO service_role;
CREATE POLICY recurring_expenses_read ON public.recurring_expenses FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']));
CREATE POLICY recurring_expenses_write ON public.recurring_expenses FOR ALL TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa'])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa']));
CREATE POLICY recurring_expense_skips_read ON public.recurring_expense_skips FOR SELECT TO authenticated
  USING (private.has_role(org_id, ARRAY['psychologa','gestoria']));
CREATE TRIGGER recurring_expenses_touch BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER recurring_expenses_org_writable BEFORE INSERT OR UPDATE OR DELETE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION private.guard_org_writable();
CREATE TRIGGER audit_recurring_expenses AFTER INSERT OR UPDATE OR DELETE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

-- A generated month that is deleted is not generated again.
CREATE OR REPLACE FUNCTION private.remember_recurring_skip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF old.recurring_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.recurring_expenses r WHERE r.id = old.recurring_id) THEN
    INSERT INTO public.recurring_expense_skips(org_id, recurring_id, month)
    VALUES (old.org_id, old.recurring_id, old.recurring_month) ON CONFLICT DO NOTHING;
  END IF;
  RETURN old;
END; $function$;
REVOKE ALL ON FUNCTION private.remember_recurring_skip() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expenses_remember_recurring_skip AFTER DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.remember_recurring_skip();

-- Records every due month (from since_month to the current month, day <= today in Madrid) of the
-- active recurring expenses. SECURITY INVOKER: the caller's RLS on public.expenses applies.
-- Returns the number of expenses created by this call.
CREATE OR REPLACE FUNCTION public.apply_recurring_expenses(p_org_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_created integer := 0; v_n integer;
  r public.recurring_expenses; m date; d date;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  FOR r IN SELECT * FROM public.recurring_expenses WHERE org_id = p_org_id AND active LOOP
    m := r.since_month;
    WHILE m <= date_trunc('month', v_today)::date LOOP
      d := m + (least(r.day_of_month, extract(day FROM (m + interval '1 month' - interval '1 day'))::int) - 1);
      IF d <= v_today AND NOT EXISTS (SELECT 1 FROM public.recurring_expense_skips s WHERE s.recurring_id = r.id AND s.month = m) THEN
        INSERT INTO public.expenses(org_id, description, category, amount_cents, expense_date, supplier, recurring_id, recurring_month)
        VALUES (p_org_id, r.name, r.category,
                r.base_cents + round(r.base_cents * r.vat_pct / 100)::int - round(r.base_cents * r.retention_pct / 100)::int,
                d, coalesce(r.supplier, r.name), r.id, m)
        ON CONFLICT (org_id, recurring_id, recurring_month) WHERE recurring_id IS NOT NULL DO NOTHING;
        GET DIAGNOSTICS v_n = ROW_COUNT; v_created := v_created + v_n;
      END IF;
      m := (m + interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN v_created;
END; $function$;
REVOKE ALL ON FUNCTION public.apply_recurring_expenses(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.apply_recurring_expenses(uuid) TO authenticated;
