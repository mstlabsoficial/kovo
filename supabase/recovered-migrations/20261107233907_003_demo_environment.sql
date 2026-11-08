-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261107233907
-- Original migration name: 003_demo_environment
-- Archival copy only; see README before replaying.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.is_demo IS
  'True only for organizations containing synthetic demo data; never use for real patient records.';

INSERT INTO public.organizations (name, is_demo)
SELECT 'KOVO DEMO — DATOS FICTICIOS', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations
  WHERE name = 'KOVO DEMO — DATOS FICTICIOS'
);
