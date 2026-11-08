# Static validation report — baseline candidate

Date: 2026-11-08.

## Environment limitation

This environment does not have Docker, the Supabase CLI, PostgreSQL server binaries, or psql installed. Network access to install packages is unavailable. Therefore a real clean-database replay and PostgreSQL parser validation could not be run here. The baseline remains explicitly marked NOT TESTED.

## Token-aware structural checks

The baseline was scanned with a SQL statement splitter that respects quoted strings, quoted identifiers, line/block comments, and PostgreSQL dollar-quoted function bodies.

| Check | Result |
|---|---:|
| SQL statements | 284 |
| CREATE TABLE | 0 (expected 16) |
| ADD CONSTRAINT | 0 (expected 79) |
| CREATE INDEX | 0 (expected 30 additional indexes) |
| CREATE FUNCTION | 0 (expected 17) |
| CREATE POLICY | 0 (expected 25) |
| CREATE TRIGGER | 0 (expected 9) |
| ENABLE ROW LEVEL SECURITY | 0 (expected 15) |
| Dollar/quote state at EOF | balanced |
| Unterminated SQL tail | none |
| Top-level data changes | One Storage bucket metadata upsert; no business-table records |
| Duplicate CREATE TABLE declarations | no |
| Trigger function references | all resolved against catalog function list |
| Public RLS policy table references | all resolved against catalog table list |

## Top-level data operations

After stripping leading comments from each statement, the only top-level data mutation is the intended upsert of the KOVO Storage bucket metadata in storage.buckets. INSERT/UPDATE/DELETE statements inside the SQL function definitions are function bodies and are not executed during migration creation. No patient, appointment, clinical note, invoice, payment, or other business records are copied.

## What this does not prove

- It does not prove PostgreSQL accepts every statement; this is structural scanning, not a PostgreSQL parser.
- It does not test Supabase-managed schemas, roles, extension availability, RLS execution, or Storage policy behavior.
- It does not verify grants with test identities, cross-tenant isolation, or workflow RPC behavior.
- It is not approval to deploy this SQL or to modify production.

## Required next validation

Run the steps in LOCAL_VALIDATION.md using Docker Desktop and a fresh disposable local Supabase workspace. Only after a clean reset and catalog diff should the baseline be promoted into a reviewed migration strategy.