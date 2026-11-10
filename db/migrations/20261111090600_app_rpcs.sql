-- KOVO · 20261111090600 · RPCs used by the connected app.

-- Weekly hours of one professional, replaced atomically (the editor sends the whole week).
-- p_ranges: [{"weekday": 1..7, "start_minute": int, "end_minute": int}, …]
CREATE OR REPLACE FUNCTION public.set_professional_availability(p_org_id uuid, p_professional_id uuid, p_ranges jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.can_edit_schedule(p_org_id, p_professional_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_ranges IS NULL OR jsonb_typeof(p_ranges) <> 'array' OR jsonb_array_length(p_ranges) > 70 THEN
    RAISE EXCEPTION 'Horario no válido' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.professional_availability WHERE org_id = p_org_id AND professional_id = p_professional_id;
  FOR r IN SELECT * FROM jsonb_array_elements(p_ranges) LOOP
    INSERT INTO public.professional_availability(org_id, professional_id, weekday, start_minute, end_minute)
    VALUES (p_org_id, p_professional_id, (r ->> 'weekday')::smallint, (r ->> 'start_minute')::int, (r ->> 'end_minute')::int);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- The signed-in person's own professional profile in a clinic (created on demand for members that
-- were invited as psychologists and do not have one yet; within the plan limit).
CREATE OR REPLACE FUNCTION public.ensure_my_professional(p_org_id uuid, p_display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_user auth.users;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_id FROM public.professionals WHERE org_id = p_org_id AND user_id = auth.uid();
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.professionals(org_id, display_name, email, user_id)
  VALUES (p_org_id, coalesce(nullif(btrim(p_display_name), ''), v_user.raw_user_meta_data ->> 'full_name', split_part(v_user.email, '@', 1)), v_user.email, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- Edit a draft invoice in place (lines, due date, retention). Same validation as save_invoice_draft;
-- only drafts (KB003). Totals are recomputed by the server.
CREATE OR REPLACE FUNCTION public.update_invoice_draft(p_invoice_id uuid, p_lines jsonb, p_due_date date DEFAULT NULL, p_retention_cents integer DEFAULT 0)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_inv public.invoices;
  v_line jsonb;
  v_qty numeric; v_unit integer; v_rate numeric; v_base bigint; v_line_total bigint;
  v_subtotal bigint := 0; v_tax bigint := 0; v_total bigint;
  v_appointment_id uuid;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL OR auth.uid() IS NULL OR NOT private.has_role(v_inv.org_id, ARRAY['psychologa','gestoria']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_inv.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden modificar borradores' USING ERRCODE = 'KB003';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 OR jsonb_array_length(p_lines) > 100 THEN
    RAISE EXCEPTION 'La factura necesita al menos una línea' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.invoice_lines WHERE invoice_id = v_inv.id AND org_id = v_inv.org_id;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_unit := (v_line->>'unit_price_cents')::integer;
    v_rate := coalesce((v_line->>'tax_rate')::numeric, 0);
    v_appointment_id := nullif(btrim(v_line->>'appointment_id'), '')::uuid;
    IF v_qty IS NULL OR v_unit IS NULL OR v_qty <= 0 OR v_unit < 0 OR v_rate < 0 OR v_rate > 100 THEN
      RAISE EXCEPTION 'Línea de factura no válida' USING ERRCODE = '22023';
    END IF;
    v_base := round(v_qty * v_unit);
    v_line_total := round(v_base * (1 + v_rate / 100));
    v_subtotal := v_subtotal + v_base;
    v_tax := v_tax + (v_line_total - v_base);
    INSERT INTO public.invoice_lines(org_id, invoice_id, appointment_id, description, quantity, unit_price_cents, tax_rate, line_total_cents)
    VALUES (v_inv.org_id, v_inv.id, v_appointment_id, coalesce(nullif(v_line->>'description', ''), 'Servicio'), v_qty, v_unit, v_rate, v_line_total);
  END LOOP;
  v_total := v_subtotal + v_tax - greatest(coalesce(p_retention_cents, 0), 0);
  IF v_total < 0 THEN RAISE EXCEPTION 'El total no puede ser negativo' USING ERRCODE = '22023'; END IF;
  UPDATE public.invoices
     SET subtotal_cents = v_subtotal, tax_cents = v_tax, total_cents = v_total,
         retention_cents = greatest(coalesce(p_retention_cents, 0), 0), due_date = coalesce(p_due_date, due_date)
   WHERE id = v_inv.id;
  RETURN v_inv.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_invoice_draft(uuid, jsonb, date, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_invoice_draft(uuid, jsonb, date, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.set_professional_availability(uuid, uuid, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_professional_availability(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ensure_my_professional(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_my_professional(uuid, text) TO authenticated;
