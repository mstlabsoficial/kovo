-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261107233451
-- Original migration name: 002_private_patient_document_storage
-- Archival copy only; see README before replaying.

-- Private clinical document bucket. Files must use: <org_uuid>/<patient_uuid>/<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kovo-patient-documents',
  'kovo-patient-documents',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update
set public=false, file_size_limit=20971520,
    allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists kovo_documents_read on storage.objects;
create policy kovo_documents_read on storage.objects
for select to authenticated
using (
  bucket_id='kovo-patient-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.has_role(((storage.foldername(name))[1])::uuid,array['psychologa'])
);

drop policy if exists kovo_documents_insert on storage.objects;
create policy kovo_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='kovo-patient-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.has_role(((storage.foldername(name))[1])::uuid,array['psychologa'])
);

drop policy if exists kovo_documents_update on storage.objects;
create policy kovo_documents_update on storage.objects
for update to authenticated
using (
  bucket_id='kovo-patient-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.has_role(((storage.foldername(name))[1])::uuid,array['psychologa'])
)
with check (
  bucket_id='kovo-patient-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.has_role(((storage.foldername(name))[1])::uuid,array['psychologa'])
);

drop policy if exists kovo_documents_delete on storage.objects;
create policy kovo_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id='kovo-patient-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.has_role(((storage.foldername(name))[1])::uuid,array['psychologa'])
);
