-- KOVO — bootstrap of a DISPOSABLE local PostgreSQL so the REAL Supabase services can run on it.
--
-- Only for the local stack started by db/local/stack.mjs (never a hosted project, never the
-- Supabase CLI stack, which already has all of this). Unlike clinical-db/local/supabase-shim.sql,
-- nothing here emulates Auth or Storage: the auth.* schema is created by Supabase Auth (GoTrue)
-- with its own migrations and storage.* by Supabase Storage with its own migrations. This file
-- only creates the roles and empty schemas those services expect to find, as Supabase does.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'local-only-authenticator'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'local-only-auth-admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'local-only-storage-admin'; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO supabase_storage_admin WITH ADMIN OPTION;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
ALTER ROLE supabase_auth_admin SET search_path = auth;
GRANT CREATE ON DATABASE kovo TO supabase_auth_admin;

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, postgres;
ALTER ROLE supabase_storage_admin SET search_path = storage;
GRANT CREATE ON DATABASE kovo TO supabase_storage_admin;
