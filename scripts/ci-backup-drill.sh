#!/bin/sh
# KOVO — simulacro de copia lógica y restauración (pg_dump / pg_restore) en la pila Supabase LOCAL de
# CI (Docker, `supabase start`). Nunca contra un proyecto alojado: solo usa el contenedor local.
#
# 1. pg_dump -Fc de la base de datos local, ya poblada por las pruebas (datos sintéticos).
# 2. pg_restore en una base de datos nueva del mismo servidor (kovo_restore).
# 3. Compara recuento y huella (md5) de las tablas de KOVO, de auth.users y de storage.objects.
# Los ficheros de Storage NO van en pg_dump (solo sus metadatos): se copian aparte (docs/ops).
set -eu
DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1)
[ -n "$DB" ] || { echo "No hay contenedor supabase_db_* local en marcha." >&2; exit 1; }
PSQL="docker exec -i $DB psql -v ON_ERROR_STOP=1 -U supabase_admin -X -A -t"

echo "· copia lógica (pg_dump -Fc) de la base local"
docker exec "$DB" pg_dump -U supabase_admin -d postgres -Fc -f /tmp/kovo.dump
docker exec "$DB" ls -la /tmp/kovo.dump

echo "· restauración en una base nueva (kovo_restore)"
$PSQL -d postgres -c "DROP DATABASE IF EXISTS kovo_restore" -c "CREATE DATABASE kovo_restore"
# Errores de objetos de la plataforma (extensiones que el servidor ya gestiona) no detienen la
# restauración; se cuentan y se comparan después los datos de KOVO, que es lo que importa.
set +e
docker exec "$DB" pg_restore -U supabase_admin -d kovo_restore --no-owner --role=postgres /tmp/kovo.dump > /tmp/restore.log 2>&1
RC=$?
set -e
echo "  pg_restore terminó con código $RC; avisos: $(grep -c 'error:' /tmp/restore.log || true)"
grep 'error:' /tmp/restore.log | sed 's/^/    /' | head -n 20 || true

CHECK="
SELECT t, n, h FROM (
  SELECT 'organizations' t, count(*) n, md5(coalesce(string_agg(id::text||name||account_status, ',' ORDER BY id),'')) h FROM public.organizations
  UNION ALL SELECT 'memberships', count(*), md5(coalesce(string_agg(id::text||user_id::text||role||is_admin::text, ',' ORDER BY id),'')) FROM public.memberships
  UNION ALL SELECT 'subscriptions', count(*), md5(coalesce(string_agg(org_id::text||plan_code||status, ',' ORDER BY org_id),'')) FROM public.subscriptions
  UNION ALL SELECT 'patients', count(*), md5(coalesce(string_agg(id::text||patient_code||first_name||last_name, ',' ORDER BY id),'')) FROM public.patients
  UNION ALL SELECT 'appointments', count(*), md5(coalesce(string_agg(id::text||patient_id::text||starts_at::text||status, ',' ORDER BY id),'')) FROM public.appointments
  UNION ALL SELECT 'clinical_notes', count(*), md5(coalesce(string_agg(id::text||status||coalesce(content,''), ',' ORDER BY id),'')) FROM public.clinical_notes
  UNION ALL SELECT 'invoices', count(*), md5(coalesce(string_agg(id::text||status||coalesce(invoice_number,'')||total_cents::text, ',' ORDER BY id),'')) FROM public.invoices
  UNION ALL SELECT 'payments', count(*), md5(coalesce(string_agg(id::text||amount_cents::text, ',' ORDER BY id),'')) FROM public.payments
  UNION ALL SELECT 'patient_documents', count(*), md5(coalesce(string_agg(id::text||storage_path, ',' ORDER BY id),'')) FROM public.patient_documents
  UNION ALL SELECT 'audit_log', count(*), md5(coalesce(string_agg(id::text||action, ',' ORDER BY id),'')) FROM public.audit_log
  UNION ALL SELECT 'auth.users', count(*), md5(coalesce(string_agg(id::text||coalesce(email,'')||coalesce(encrypted_password,''), ',' ORDER BY id),'')) FROM auth.users
  UNION ALL SELECT 'storage.objects', count(*), md5(coalesce(string_agg(bucket_id||'/'||name, ',' ORDER BY bucket_id, name),'')) FROM storage.objects
) x ORDER BY t;"

echo "$CHECK" | $PSQL -d postgres > /tmp/orig.txt
echo "$CHECK" | $PSQL -d kovo_restore > /tmp/rest.txt
echo "· original:"; sed 's/^/    /' /tmp/orig.txt
if diff -u /tmp/orig.txt /tmp/rest.txt; then
  PATIENTS=$(grep '^patients|' /tmp/orig.txt | cut -d'|' -f2)
  [ "${PATIENTS:-0}" -gt 0 ] || { echo "✗ La base original no tenía pacientes: el simulacro no prueba nada." >&2; exit 1; }
  echo "✓ Restauración lógica: tablas de KOVO, cuentas y metadatos de Storage idénticos"
else
  echo "✗ La restauración no coincide con el original" >&2; exit 1
fi
$PSQL -d postgres -c "DROP DATABASE kovo_restore" > /dev/null
docker exec "$DB" rm -f /tmp/kovo.dump
