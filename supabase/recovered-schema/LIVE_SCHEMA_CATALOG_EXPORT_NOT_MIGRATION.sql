-- KOVO LIVE SCHEMA CATALOG EXPORT — NOT A MIGRATION
-- Captured read-only from Supabase project otlwmrbioawjvgrrznoq on 2026-11-08.
-- DO NOT place this file in supabase/migrations or run it against production.
-- This is a reference export assembled from PostgreSQL catalogs, not a tested
-- clean-install baseline. Replay order and migration-history reconciliation
-- are documented in README.md.

CREATE SCHEMA IF NOT EXISTS private;
SET search_path = public, extensions;

-- 1. Tables and columns (constraints are added after all tables exist).
CREATE TABLE private.org_counters (
  "org_id" uuid NOT NULL,
  "counter_type" text NOT NULL,
  "last_value" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.appointments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "professional_id" uuid,
  "service_id" uuid,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'scheduled'::text NOT NULL,
  "location" text,
  "administrative_note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "legacy_id" text,
  "modality" text,
  "price_cents" integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.audit_log (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "org_id" uuid NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.clinical_note_rectifications (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "note_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "replacement_text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.clinical_notes (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "appointment_id" uuid,
  "author_id" uuid,
  "note_type" text DEFAULT 'session'::text NOT NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "signed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.employees (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "role_title" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.expenses (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "description" text NOT NULL,
  "category" text,
  "amount_cents" integer NOT NULL,
  "expense_date" date DEFAULT CURRENT_DATE NOT NULL,
  "supplier" text,
  "document_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "legacy_id" text
);

CREATE TABLE public.invoice_lines (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
  "line_total_cents" integer NOT NULL
);

CREATE TABLE public.invoices (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "patient_id" uuid,
  "invoice_number" text,
  "issue_date" date DEFAULT CURRENT_DATE NOT NULL,
  "due_date" date,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "currency" character(3) DEFAULT 'EUR'::bpchar NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "tax_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "legacy_id" text,
  "series" text,
  "retention_cents" integer DEFAULT 0 NOT NULL,
  "legacy_status" text
);

CREATE TABLE public.memberships (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.organizations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_demo" boolean DEFAULT false NOT NULL
);

CREATE TABLE public.patient_documents (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "storage_path" text NOT NULL,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.patients (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "patient_code" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "birth_date" date,
  "address" text,
  "emergency_contact" text,
  "administrative_notes" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "legacy_id" text,
  "profile_data" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.payments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "method" text,
  "reference" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.professionals (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "email" text,
  "phone" text,
  "professional_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.services (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "duration_minutes" integer NOT NULL,
  "price_cents" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tax_exempt" boolean DEFAULT false NOT NULL,
  "legacy_id" text
);

-- 2. Table constraints.
ALTER TABLE private.org_counters ADD CONSTRAINT "org_counters_counter_type_check" CHECK (counter_type = ANY (ARRAY['patient'::text, 'invoice'::text]));
ALTER TABLE private.org_counters ADD CONSTRAINT "org_counters_last_value_check" CHECK (last_value >= 0);
ALTER TABLE private.org_counters ADD CONSTRAINT "org_counters_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE private.org_counters ADD CONSTRAINT "org_counters_pkey" PRIMARY KEY (org_id, counter_type);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_check" CHECK (ends_at > starts_at);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_org_id_patient_id_fkey" FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_org_id_professional_id_fkey" FOREIGN KEY (org_id, professional_id) REFERENCES professionals(org_id, id);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_org_id_service_id_fkey" FOREIGN KEY (org_id, service_id) REFERENCES services(org_id, id);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_pkey" PRIMARY KEY (id);
ALTER TABLE public.appointments ADD CONSTRAINT "appointments_status_check" CHECK (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));
ALTER TABLE public.audit_log ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_log ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "clinical_note_rectifications_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "clinical_note_rectifications_note_id_fkey" FOREIGN KEY (note_id) REFERENCES clinical_notes(id) ON DELETE RESTRICT;
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "clinical_note_rectifications_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "clinical_note_rectifications_pkey" PRIMARY KEY (id);
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "clinical_note_rectifications_reason_check" CHECK (length(TRIM(BOTH FROM reason)) >= 10);
ALTER TABLE public.clinical_note_rectifications ADD CONSTRAINT "rectifications_note_org_fk" FOREIGN KEY (org_id, note_id) REFERENCES clinical_notes(org_id, id);
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_org_id_appointment_id_fkey" FOREIGN KEY (org_id, appointment_id) REFERENCES appointments(org_id, id);
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_org_id_id_unique" UNIQUE (org_id, id);
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_org_id_patient_id_fkey" FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id);
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public.clinical_notes ADD CONSTRAINT "clinical_notes_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'signed'::text, 'rectified'::text]));
ALTER TABLE public.employees ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT "employees_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.employees ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);
ALTER TABLE public.expenses ADD CONSTRAINT "expenses_amount_cents_check" CHECK (amount_cents >= 0);
ALTER TABLE public.expenses ADD CONSTRAINT "expenses_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD CONSTRAINT "expenses_pkey" PRIMARY KEY (id);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_line_total_cents_check" CHECK (line_total_cents >= 0);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_org_id_invoice_id_fkey" FOREIGN KEY (org_id, invoice_id) REFERENCES invoices(org_id, id);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_pkey" PRIMARY KEY (id);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_quantity_check" CHECK (quantity > 0::numeric);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_tax_rate_check" CHECK (tax_rate >= 0::numeric AND tax_rate <= 100::numeric);
ALTER TABLE public.invoice_lines ADD CONSTRAINT "invoice_lines_unit_price_cents_check" CHECK (unit_price_cents >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_org_id_invoice_number_key" UNIQUE (org_id, invoice_number);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_org_id_patient_id_fkey" FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_pkey" PRIMARY KEY (id);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'partially_paid'::text, 'void'::text]));
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_subtotal_cents_check" CHECK (subtotal_cents >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_tax_cents_check" CHECK (tax_cents >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT "invoices_total_cents_check" CHECK (total_cents >= 0);
ALTER TABLE public.memberships ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT "memberships_org_user_unique" UNIQUE (org_id, user_id);
ALTER TABLE public.memberships ADD CONSTRAINT "memberships_pkey" PRIMARY KEY (id);
ALTER TABLE public.memberships ADD CONSTRAINT "memberships_role_check" CHECK (role = ANY (ARRAY['psychologa'::text, 'recepcion'::text, 'gestoria'::text]));
ALTER TABLE public.memberships ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.organizations ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);
ALTER TABLE public.patient_documents ADD CONSTRAINT "patient_documents_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.patient_documents ADD CONSTRAINT "patient_documents_org_id_patient_id_fkey" FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id);
ALTER TABLE public.patient_documents ADD CONSTRAINT "patient_documents_org_id_storage_path_key" UNIQUE (org_id, storage_path);
ALTER TABLE public.patient_documents ADD CONSTRAINT "patient_documents_pkey" PRIMARY KEY (id);
ALTER TABLE public.patient_documents ADD CONSTRAINT "patient_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD CONSTRAINT "patients_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.patients ADD CONSTRAINT "patients_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.patients ADD CONSTRAINT "patients_org_id_patient_code_key" UNIQUE (org_id, patient_code);
ALTER TABLE public.patients ADD CONSTRAINT "patients_pkey" PRIMARY KEY (id);
ALTER TABLE public.patients ADD CONSTRAINT "patients_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]));
ALTER TABLE public.payments ADD CONSTRAINT "payments_amount_cents_check" CHECK (amount_cents > 0);
ALTER TABLE public.payments ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT "payments_org_id_invoice_id_fkey" FOREIGN KEY (org_id, invoice_id) REFERENCES invoices(org_id, id);
ALTER TABLE public.payments ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE public.professionals ADD CONSTRAINT "professionals_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.professionals ADD CONSTRAINT "professionals_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.professionals ADD CONSTRAINT "professionals_pkey" PRIMARY KEY (id);
ALTER TABLE public.services ADD CONSTRAINT "services_duration_minutes_check" CHECK (duration_minutes >= 5 AND duration_minutes <= 480);
ALTER TABLE public.services ADD CONSTRAINT "services_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.services ADD CONSTRAINT "services_org_id_id_key" UNIQUE (org_id, id);
ALTER TABLE public.services ADD CONSTRAINT "services_pkey" PRIMARY KEY (id);
ALTER TABLE public.services ADD CONSTRAINT "services_price_cents_check" CHECK (price_cents >= 0);

-- 3. Indexes not already created by PRIMARY KEY / UNIQUE constraints.
CREATE INDEX appointments_created_by_idx ON public.appointments USING btree (created_by);
CREATE UNIQUE INDEX appointments_org_legacy_id_uq ON public.appointments USING btree (org_id, legacy_id) WHERE (legacy_id IS NOT NULL);
CREATE INDEX appointments_org_professional_idx ON public.appointments USING btree (org_id, professional_id);
CREATE INDEX appointments_org_service_idx ON public.appointments USING btree (org_id, service_id);
CREATE INDEX appointments_org_start_idx ON public.appointments USING btree (org_id, starts_at);
CREATE INDEX appointments_patient_idx ON public.appointments USING btree (org_id, patient_id, starts_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log USING btree (actor_id);
CREATE INDEX audit_org_created_idx ON public.audit_log USING btree (org_id, created_at DESC);
CREATE INDEX rectifications_author_idx ON public.clinical_note_rectifications USING btree (author_id);
CREATE INDEX rectifications_note_idx ON public.clinical_note_rectifications USING btree (note_id);
CREATE INDEX rectifications_org_idx ON public.clinical_note_rectifications USING btree (org_id);
CREATE INDEX rectifications_org_note_idx ON public.clinical_note_rectifications USING btree (org_id, note_id);
CREATE INDEX clinical_notes_author_idx ON public.clinical_notes USING btree (author_id);
CREATE INDEX clinical_notes_org_appointment_idx ON public.clinical_notes USING btree (org_id, appointment_id);
CREATE INDEX notes_patient_idx ON public.clinical_notes USING btree (org_id, patient_id, created_at DESC);
CREATE INDEX expenses_org_idx ON public.expenses USING btree (org_id);
CREATE UNIQUE INDEX expenses_org_legacy_id_uq ON public.expenses USING btree (org_id, legacy_id) WHERE (legacy_id IS NOT NULL);
CREATE INDEX invoice_lines_org_idx ON public.invoice_lines USING btree (org_id);
CREATE INDEX invoice_lines_org_invoice_idx ON public.invoice_lines USING btree (org_id, invoice_id);
CREATE UNIQUE INDEX invoices_org_legacy_id_uq ON public.invoices USING btree (org_id, legacy_id) WHERE (legacy_id IS NOT NULL);
CREATE INDEX invoices_patient_idx ON public.invoices USING btree (org_id, patient_id, issue_date DESC);
CREATE INDEX memberships_org_idx ON public.memberships USING btree (org_id);
CREATE INDEX memberships_user_active_idx ON public.memberships USING btree (user_id, active);
CREATE INDEX patient_documents_org_patient_idx ON public.patient_documents USING btree (org_id, patient_id);
CREATE INDEX patient_documents_uploaded_by_idx ON public.patient_documents USING btree (uploaded_by);
CREATE UNIQUE INDEX patients_org_legacy_id_uq ON public.patients USING btree (org_id, legacy_id) WHERE (legacy_id IS NOT NULL);
CREATE INDEX patients_org_name_idx ON public.patients USING btree (org_id, last_name, first_name);
CREATE INDEX payments_org_idx ON public.payments USING btree (org_id);
CREATE INDEX payments_org_invoice_idx ON public.payments USING btree (org_id, invoice_id);
CREATE UNIQUE INDEX services_org_legacy_id_uq ON public.services USING btree (org_id, legacy_id) WHERE (legacy_id IS NOT NULL);

-- 4. Private and public functions from the live catalog.
CREATE OR REPLACE FUNCTION private.assign_patient_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v bigint;
begin
 if new.patient_code is null or btrim(new.patient_code)='' or new.patient_code='AUTO' then
   insert into private.org_counters(org_id,counter_type,last_value)
   values(new.org_id,'patient',1)
   on conflict(org_id,counter_type) do update
   set last_value=private.org_counters.last_value+1 returning last_value into v;
   new.patient_code := 'P-' || lpad(v::text,5,'0');
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.emit_invoice(p_invoice uuid)
 RETURNS invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.invoices; n bigint;
begin
 select * into v from public.invoices where id=p_invoice for update;
 if not found or not private.has_role(v.org_id,array['psychologa','gestoria']) then raise exception 'Not authorized'; end if;
 if v.status <> 'draft' then raise exception 'Only draft invoices can be issued'; end if;
 n := private.next_counter(v.org_id,'invoice');
 update public.invoices set invoice_number='KOVO-'||to_char(issue_date,'YYYY')||'-'||lpad(n::text,6,'0'),
 status='issued' where id=p_invoice returning * into v;
 insert into public.audit_log(org_id,actor_id,action,entity_type,entity_id,metadata)
 values(v.org_id,auth.uid(),'emit','invoice',v.id,jsonb_build_object('invoice_number',v.invoice_number));
 return v;
end; $function$;

CREATE OR REPLACE FUNCTION private.has_role(target_org uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.memberships m where m.org_id=target_org and m.user_id=(select auth.uid()) and m.active and m.role=any(allowed_roles)); $function$;

CREATE OR REPLACE FUNCTION private.my_orgs()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select m.org_id from public.memberships m where m.user_id = (select auth.uid()) and m.active; $function$;

CREATE OR REPLACE FUNCTION private.next_counter(p_org uuid, p_type text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v bigint;
begin
 if auth.uid() is null or not exists (
   select 1 from public.memberships m where m.org_id=p_org and m.user_id=auth.uid() and m.active
 ) then raise exception 'Not authorized'; end if;
 insert into private.org_counters(org_id,counter_type,last_value)
 values(p_org,p_type,1)
 on conflict(org_id,counter_type) do update
 set last_value=private.org_counters.last_value+1
 returning last_value into v;
 return v;
end; $function$;

CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_line_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO v_old_status
    FROM public.invoices
    WHERE id = OLD.invoice_id AND org_id = OLD.org_id;
    IF v_old_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Invoice lines cannot be changed or removed after issue.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT status INTO v_new_status
    FROM public.invoices
    WHERE id = NEW.invoice_id AND org_id = NEW.org_id;
    IF v_new_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Invoice lines can only be added to draft invoices.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_issued_invoice_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'An issued invoice is immutable; use an authorized correction workflow.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_signed_note_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.status in ('signed','rectified') then
   raise exception 'A signed clinical note cannot be modified or deleted; use a rectification.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.rectify_clinical_note(p_note uuid, p_reason text, p_replacement text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.clinical_notes; new_id uuid;
begin
 select * into v from public.clinical_notes where id=p_note for update;
 if not found or not private.has_role(v.org_id,array['psychologa']) then raise exception 'Not authorized'; end if;
 if v.status <> 'signed' then raise exception 'Only signed notes can be rectified'; end if;
 if length(trim(coalesce(p_reason,''))) < 10 or length(trim(coalesce(p_replacement,'')))=0 then
   raise exception 'A reason and replacement text are required';
 end if;
 insert into public.clinical_note_rectifications(org_id,note_id,author_id,reason,replacement_text)
 values(v.org_id,v.id,auth.uid(),p_reason,p_replacement) returning id into new_id;
 insert into public.audit_log(org_id,actor_id,action,entity_type,entity_id,metadata)
 values(v.org_id,auth.uid(),'rectify','clinical_note',v.id,jsonb_build_object('rectification_id',new_id));
 return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION private.sign_clinical_note(p_note uuid)
 RETURNS clinical_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.clinical_notes;
begin
 select * into v from public.clinical_notes where id=p_note for update;
 if not found or not private.has_role(v.org_id,array['psychologa']) then raise exception 'Not authorized'; end if;
 if v.status <> 'draft' then raise exception 'Only draft notes can be signed'; end if;
 update public.clinical_notes set status='signed', signed_at=now(), author_id=auth.uid(), updated_at=now()
 where id=p_note returning * into v;
 insert into public.audit_log(org_id,actor_id,action,entity_type,entity_id)
 values(v.org_id,auth.uid(),'sign','clinical_note',v.id);
 return v;
end; $function$;

CREATE OR REPLACE FUNCTION private.write_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org uuid; v_id uuid; v_action text;
begin
 if tg_op='DELETE' then v_org:=old.org_id; v_id:=old.id; v_action:='delete';
 elsif tg_op='INSERT' then v_org:=new.org_id; v_id:=new.id; v_action:='insert';
 else v_org:=new.org_id; v_id:=new.id; v_action:='update';
 end if;
 insert into public.audit_log(org_id,actor_id,action,entity_type,entity_id,metadata)
 values(v_org,auth.uid(),v_action,tg_table_name,v_id,
   jsonb_build_object('source','database_trigger'));
 if tg_op='DELETE' then return old; else return new; end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.delete_clinical_note_draft(p_org_id uuid, p_note_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized to manage clinical notes' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.clinical_notes
  WHERE id=p_note_id AND org_id=p_org_id AND author_id=auth.uid() AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found or not deletable'; END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.emit_invoice(p_invoice uuid)
 RETURNS invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.invoices;
BEGIN
  SELECT * INTO v FROM public.invoices WHERE id=p_invoice FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa','gestoria']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.emit_invoice(p_invoice);
END; $function$;

CREATE OR REPLACE FUNCTION public.rectify_clinical_note(p_note uuid, p_reason text, p_replacement text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.clinical_notes;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id=p_note;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.rectify_clinical_note(p_note,p_reason,p_replacement);
END; $function$;

CREATE OR REPLACE FUNCTION public.save_clinical_note_draft(p_org_id uuid, p_patient_id uuid, p_appointment_id uuid, p_note_type text, p_content text, p_note_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_org_id, ARRAY['psychologa']) THEN
    RAISE EXCEPTION 'Not authorized to manage clinical notes' USING ERRCODE='42501';
  END IF;
  IF p_content IS NULL OR length(trim(p_content))=0 THEN
    RAISE EXCEPTION 'Clinical note content cannot be empty';
  END IF;
  IF p_note_id IS NULL THEN
    INSERT INTO public.clinical_notes(org_id,patient_id,appointment_id,author_id,note_type,content,status)
    VALUES(p_org_id,p_patient_id,p_appointment_id,auth.uid(),coalesce(nullif(p_note_type,''),'session'),p_content,'draft')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.clinical_notes
      SET content=p_content,note_type=coalesce(nullif(p_note_type,''),'session'),updated_at=now()
      WHERE id=p_note_id AND org_id=p_org_id AND author_id=auth.uid() AND status='draft'
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Draft not found or not editable'; END IF;
  END IF;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.save_invoice_draft(p_org_id uuid, p_patient_id uuid, p_issue_date date, p_due_date date, p_lines jsonb, p_legacy_id text DEFAULT NULL::text, p_retention_cents integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_subtotal bigint:=0; v_tax bigint:=0; v_total bigint:=0; v_line jsonb; v_qty numeric; v_unit integer; v_rate numeric; v_base bigint; v_line_total bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(p_org_id,ARRAY['psychologa','gestoria']) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_lines IS NULL OR jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one invoice line is required'; END IF;
 INSERT INTO public.invoices(org_id,patient_id,invoice_number,issue_date,due_date,status,subtotal_cents,tax_cents,total_cents,retention_cents,legacy_id)
 VALUES(p_org_id,p_patient_id,NULL,coalesce(p_issue_date,current_date),p_due_date,'draft',0,0,0,greatest(coalesce(p_retention_cents,0),0),p_legacy_id)
 RETURNING id INTO v_id;
 FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   v_qty:=(v_line->>'quantity')::numeric;
   v_unit:=(v_line->>'unit_price_cents')::integer;
   v_rate:=coalesce((v_line->>'tax_rate')::numeric,0);
   IF v_qty<=0 OR v_unit<0 OR v_rate<0 OR v_rate>100 THEN RAISE EXCEPTION 'Invalid invoice line'; END IF;
   v_base:=round(v_qty*v_unit);
   v_line_total:=round(v_base*(1+v_rate/100));
   v_subtotal:=v_subtotal+v_base; v_tax:=v_tax+(v_line_total-v_base);
   INSERT INTO public.invoice_lines(org_id,invoice_id,description,quantity,unit_price_cents,tax_rate,line_total_cents)
   VALUES(p_org_id,v_id,coalesce(v_line->>'description','Servicio'),v_qty,v_unit,v_rate,v_line_total);
 END LOOP;
 v_total:=v_subtotal+v_tax-greatest(coalesce(p_retention_cents,0),0);
 IF v_total<0 THEN RAISE EXCEPTION 'Invoice total cannot be negative'; END IF;
 UPDATE public.invoices SET subtotal_cents=v_subtotal,tax_cents=v_tax,total_cents=v_total WHERE id=v_id;
 RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.sign_clinical_note(p_note uuid)
 RETURNS clinical_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.clinical_notes;
BEGIN
  SELECT * INTO v FROM public.clinical_notes WHERE id=p_note FOR UPDATE;
  IF NOT FOUND OR NOT private.has_role(v.org_id,ARRAY['psychologa']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN private.sign_clinical_note(p_note);
END; $function$;

-- 5. Explicit function EXECUTE grants. ACL-null functions retain PostgreSQL defaults.
REVOKE ALL ON FUNCTION private.emit_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.emit_invoice(uuid) TO postgres, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, text[]) TO postgres, authenticated;
REVOKE ALL ON FUNCTION private.my_orgs() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.my_orgs() TO postgres, authenticated;
REVOKE ALL ON FUNCTION private.next_counter(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.next_counter(uuid, text) TO postgres;
REVOKE ALL ON FUNCTION private.rectify_clinical_note(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.rectify_clinical_note(uuid, text, text) TO postgres, authenticated;
REVOKE ALL ON FUNCTION private.sign_clinical_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.sign_clinical_note(uuid) TO postgres, authenticated;
REVOKE ALL ON FUNCTION private.write_audit_event() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.write_audit_event() TO postgres;
REVOKE ALL ON FUNCTION public.delete_clinical_note_draft(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_clinical_note_draft(uuid, uuid) TO postgres, authenticated, service_role;
REVOKE ALL ON FUNCTION public.emit_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.emit_invoice(uuid) TO postgres, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rectify_clinical_note(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rectify_clinical_note(uuid, text, text) TO postgres, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_clinical_note_draft(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_clinical_note_draft(uuid, uuid, uuid, text, text, uuid) TO postgres, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_invoice_draft(uuid, uuid, date, date, jsonb, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_invoice_draft(uuid, uuid, date, date, jsonb, text, integer) TO postgres, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sign_clinical_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_clinical_note(uuid) TO postgres, authenticated, service_role;

-- 6. RLS enablement and policies.
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_rectifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_insert" ON public.appointments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "appointments_read" ON public.appointments AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "appointments_update" ON public.appointments AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "audit_log_psychologist_read" ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text]));
CREATE POLICY "rectifications_psychologist_read" ON public.clinical_note_rectifications AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text]));
CREATE POLICY "clinical_notes_psychologist_read" ON public.clinical_notes AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text]));
CREATE POLICY "employees_psychologist_all" ON public.employees AS PERMISSIVE FOR ALL TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text]));
CREATE POLICY "expenses_finance_all" ON public.expenses AS PERMISSIVE FOR ALL TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "invoice_lines_finance_all" ON public.invoice_lines AS PERMISSIVE FOR ALL TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "invoices_finance_insert" ON public.invoices AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "invoices_finance_read" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "invoices_finance_update" ON public.invoices AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "memberships_select_org_member" ON public.memberships AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT private.my_orgs() AS my_orgs)));
CREATE POLICY "organizations_select_member" ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated USING ((id IN ( SELECT private.my_orgs() AS my_orgs)));
CREATE POLICY "patient_documents_psychologist" ON public.patient_documents AS PERMISSIVE FOR ALL TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text]));
CREATE POLICY "patients_insert" ON public.patients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "patients_read" ON public.patients AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "patients_update" ON public.patients AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'recepcion'::text]));
CREATE POLICY "payments_finance_all" ON public.payments AS PERMISSIVE FOR ALL TO authenticated USING (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text])) WITH CHECK (private.has_role(org_id, ARRAY['psychologa'::text, 'gestoria'::text]));
CREATE POLICY "professionals_read" ON public.professionals AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT private.my_orgs() AS my_orgs)));
CREATE POLICY "services_read" ON public.services AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT private.my_orgs() AS my_orgs)));
CREATE POLICY "kovo_documents_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'kovo-patient-documents'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['psychologa'::text])));
CREATE POLICY "kovo_documents_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'kovo-patient-documents'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['psychologa'::text])));
CREATE POLICY "kovo_documents_read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kovo-patient-documents'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['psychologa'::text])));
CREATE POLICY "kovo_documents_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'kovo-patient-documents'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['psychologa'::text]))) WITH CHECK (((bucket_id = 'kovo-patient-documents'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['psychologa'::text])));

-- 7. Table grants recorded in information_schema.role_table_grants.
REVOKE ALL ON TABLE private.org_counters FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.appointments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.clinical_note_rectifications FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.clinical_notes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.employees FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.expenses FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.invoice_lines FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.invoices FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.memberships FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.organizations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.patient_documents FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.patients FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.payments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.professionals FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.services FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE private.org_counters TO postgres;
GRANT INSERT, SELECT, UPDATE ON TABLE public.appointments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.appointments TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.appointments TO service_role;
GRANT SELECT ON TABLE public.audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO service_role;
GRANT SELECT ON TABLE public.clinical_note_rectifications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clinical_note_rectifications TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clinical_note_rectifications TO service_role;
GRANT SELECT ON TABLE public.clinical_notes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clinical_notes TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clinical_notes TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.employees TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.employees TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.employees TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.expenses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expenses TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expenses TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.invoice_lines TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.invoice_lines TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.invoice_lines TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.invoices TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.invoices TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.invoices TO service_role;
GRANT SELECT ON TABLE public.memberships TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.memberships TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.memberships TO service_role;
GRANT SELECT ON TABLE public.organizations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizations TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizations TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.patient_documents TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.patient_documents TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.patient_documents TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.patients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.patients TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.patients TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.payments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payments TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payments TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.professionals TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.professionals TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.professionals TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.services TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.services TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.services TO service_role;

-- 8. Private schema access.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 9. Triggers.
CREATE TRIGGER audit_appointments AFTER INSERT OR DELETE OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();
CREATE TRIGGER clinical_notes_immutable BEFORE DELETE OR UPDATE ON clinical_notes FOR EACH ROW EXECUTE FUNCTION private.prevent_signed_note_mutation();
CREATE TRIGGER audit_expenses AFTER INSERT OR DELETE OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();
CREATE TRIGGER invoice_lines_immutable_after_issue BEFORE INSERT OR DELETE OR UPDATE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION private.prevent_issued_invoice_line_mutation();
CREATE TRIGGER audit_invoices AFTER INSERT OR DELETE OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();
CREATE TRIGGER invoices_immutable_after_issue BEFORE DELETE OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION private.prevent_issued_invoice_mutation();
CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();
CREATE TRIGGER patients_assign_code BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION private.assign_patient_code();
CREATE TRIGGER audit_payments AFTER INSERT OR DELETE OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

-- 10. KOVO private Storage bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('kovo-patient-documents','kovo-patient-documents',false,20971520,ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, public=EXCLUDED.public,
  file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;
