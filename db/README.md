# KOVO · base de datos consolidada (`db/`)

Estado a 10/11/2026, rama `feat/kovo-consolidacion` (solo local). **Nada de esto está aplicado en ningún
proyecto alojado de Supabase** (ni staging ni producción). `supabase/migrations` (006–008, la historia
que corresponde a producción) no se ha tocado.

## 1. Cadena de esquema

Para entornos **nuevos** (local, CI y un futuro staging), en este orden (`db/schema.mjs`):

| # | Pieza | Origen | Estado |
|---|---|---|---|
| 1 | Baseline recuperado del proyecto actual | `origin/chore/recover-supabase-migrations` (solo lectura, `git show`) | Candidato: probado aquí, no comparado aún con producción con `pg_dump --schema-only` |
| 2 | Propuesta backend 20261108 (perfiles fiscales, emisión, contadores) | `origin/docs/backend-gap-design` (solo lectura) | Probada aquí |
| 3 | Notas clínicas v2 | `clinical-db/proposals/` | Probada aquí |
| 4 | Cadena SaaS | `db/migrations/*.sql` | Probada aquí |

Migraciones de `db/migrations` (orden de nombre):

| Archivo | Contenido |
|---|---|
| `20261111090000_patient_code_counter` | Código de paciente sin colisiones: contador por clínica que salta códigos ocupados y se sincroniza con códigos importados. |
| `20261111090100_accounts_sessions_admins` | Estado de la cuenta (activa/suspendida/cerrada), administración por clínica, sesiones revocables (`session_ok`), clínica en solo lectura si está suspendida. |
| `20261111090200_team_settings_availability` | Ajustes de la clínica, servicios, profesionales vinculados a usuarios, horario semanal y ausencias, invitaciones (token guardado como hash), equipo. |
| `20261111090300_saas_plans_subscriptions` | Planes (límites provisionales, precios sin definir), suscripciones, alta de clínica, panel de KOVO, soporte, eventos de la pasarela de pago. |
| `20261111090400_documents_payments_audit` | Documentos (validación, ruta, retirada lógica, Storage), cobros con estado de la factura, cola de recordatorios, auditoría de cambios (solo nombres de campo). |
| `20261111090500_function_grants` | `EXECUTE` solo para `authenticated` (y `apply_billing_event` solo para `service_role`). |
| `20261111090600_app_rpcs` | Horario semanal atómico, ficha profesional propia, edición de borradores de factura. |
| `20261112090100_patient_diagnoses_tests` | Diagnósticos y pruebas: solo psicóloga, retirada lógica (sin DELETE), integridad paciente↔prueba↔documento (KC001–KC003), auditoría. |
| `20261112090200_recurring_expenses` | Gastos fijos + `apply_recurring_expenses` (idempotente; un mes borrado no se recrea). Columnas `expenses.recurring_id/recurring_month`. |
| `20261112090300_agenda_role` | Rol `agenda` (solo calendario) en membresías e invitaciones; RPC `agenda_calendar` (códigos, sin nombres). |
| `20261112090400_patient_export_audit` | RPC `log_patient_export`: deja en `audit_log` quién exportó los datos de qué paciente y cuándo (solo psicólogas; metadatos = recuentos por apartado, ningún dato personal). Permitida con la cuenta suspendida. |
| `20261112090000_appointment_series` | Citas repetidas: columna `appointments.series_id` (nullable) + índice. Alta de la serie = una inserción (todo o nada); «esta y las siguientes» = una actualización. Aditiva. |

### Aplicar a una base que ya tiene datos

`db/tests/upgrade.mjs` lo comprueba: una base con datos en el esquema actual (1+2+3) pasa a la cadena
completa sin perder ni cambiar ninguna fila (ids, relaciones y valores), auditoría, objetos de Storage ni
cuentas. Después de aplicar DDL hay que recargar la caché de PostgREST (`NOTIFY pgrst, 'reload schema'`;
en Supabase alojado lo hace su disparador de eventos).

**Antes de producción** (pasos que requieren aprobación, ver `docs/ops/README.md`):
1. `pg_dump --schema-only` de producción y diferencia con el baseline candidato.
2. Reconciliar `supabase/migrations` con la historia real del proyecto (sin `migration repair` hasta aprobarlo).
3. Ensayo completo en staging con copia anonimizada o sintética.
4. Decidir el plan de las clínicas existentes (hoy quedan sin plan: `plan_code = null`).

## 2. Cómo ejecutarlo

Requisitos locales (sin Docker): `app/.tools` con Node, PostgreSQL 17 embebido, PostgREST, Supabase Auth
(GoTrue) y Supabase Storage v1.30.0. Todo se crea en un directorio temporal y se borra al terminar.

```bash
export PATH=$PWD/app/.tools/node/bin:$PATH
node db/run.mjs                 # pgTAP + HTTP + concurrencia + migración de datos + copia/restauración
node db/run.mjs --e2e           # + recorridos en el navegador contra la pila completa
node db/run.mjs --only=tap,http # subconjunto
node db/run.mjs --serve         # deja la pila arrancada e imprime VITE_SUPABASE_URL / clave para usar la app
```

En CI (`.github/workflows/kovo-ci.yml`): `supabase start` en Docker y `node db/run.mjs --external --e2e`
(adaptador `db/local/external.mjs`, que se niega a usar direcciones no locales) más
`scripts/ci-backup-drill.sh` (pg_dump / pg_restore). **El workflow no se ha ejecutado todavía**: requiere
subir la rama (pendiente de autorización).

## 3. Pruebas (todas contra servicios reales locales, no simulados)

| Suite | Qué prueba | Resultado (10/11/2026) |
|---|---|---|
| pgTAP consolidado (`tests/saas_test.sql`) | códigos, alta, aislamiento, roles, ajustes, horario, auditoría, invitaciones, límites de plan, plataforma, suspensión, sesiones, facturas y cobros, documentos, recordatorios, pasarela | 123/123 |
| pgTAP clínico v2 sobre la cadena completa | integridad, roles, firma, versiones, auditoría | 81/81 |
| HTTP (`tests/http.mjs`) | registro de exportaciones de pacientes (quién, cuándo, solo recuentos; también con la cuenta suspendida), días cerrados (RLS por profesional), series de citas (todo o nada, reintento, cancelación parcial, aislamiento), tokens reales de Supabase Auth, PostgREST y Storage: alta, aislamiento, escalada de privilegios, REST/RPC directos, Storage (subida, descarga, otra clínica, manipulación de ruta, tipo, tamaño, sobrescritura, borrado), sesiones (cierre, rotación, reutilización), tokens caducados/falsos/manipulados, facturación, plataforma, suspensión, soporte, webhook | 124/129 |
| Concurrencia (`tests/concurrency.mjs`) | 30 altas simultáneas, reservas solapadas, invitaciones, cobros, emisiones | 10/10 |
| Migración de datos (`tests/upgrade.mjs`) | ver §1 | 27/27 |
| Copia y restauración (`tests/backup.mjs`) | copia física en frío de PostgreSQL + ficheros de Storage → restauración en otro servidor → 70 tablas idénticas (recuento + md5), contraseñas, documentos | 5/5 |
| E2E (`app/tests/stack`) | navegador real contra la pila completa: alta → operación diaria, agenda v3 (días cerrados, serie, mover, cancelar serie), equipo, varias clínicas, suspensión y panel de KOVO, sesión y red, móvil | 8/8 |

## 4. Matriz de permisos (la aplica PostgreSQL; la interfaz solo la refleja)

L = leer · E = escribir · — = sin acceso. «Admin» = miembro con `is_admin` (cualquier rol). Todo exige
membresía activa, sesión no revocada y, para escribir, cuenta de la clínica activa.

| Recurso | Psicóloga | Recepción | Gestoría | Admin (además) | Personal KOVO |
|---|---|---|---|---|---|
| Pacientes | L/E | L/E | — | | solo recuentos |
| Citas | L/E | L/E | — | | — |
| Notas clínicas | L; borrador por RPC | — | — | | — |
| Documentos clínicos (filas + Storage) | L, subir, retirar | — | — | | — |
| Facturas (borrador, emitir, cobrar) | L/E por RPC | — | L/E por RPC | | — |
| Perfiles fiscales (clínica y pacientes) | L/E | — | L/E | | — |
| Gastos | L/E (borrar: **no**, el baseline no concede DELETE) | — | L/E | | — |
| Gastos fijos | L/E; apuntar meses | — | L; apuntar meses | | — |
| Diagnósticos y pruebas | L/E; retirar (no borrar) | — | — | | — |
| Servicios | L/E | L | L | | — |
| Profesionales | L; editar la propia | L | L | alta y edición de todas | recuentos |
| Horario y ausencias | L; editar el propio | L | L | editar cualquiera | — |
| Datos de la clínica (nombre, zona, ajustes) | L | L | L | E | — |
| Equipo e invitaciones | ver equipo | ver equipo | ver equipo | invitar, revocar, cambiar rol, activar | — |
| Suscripción | L | L | L | cambiar plan (en prueba), cancelar | corregir con motivo |
| Soporte | abrir y leer los de su clínica (también suspendida) | ídem | ídem | | leer todos, responder |
| Auditoría de la clínica | — | — | — | L | registro propio de plataforma |
| Estado de la cuenta | — | — | — | — | suspender / reactivar con motivo |
| Eventos de pago | — | — | — | — | solo el servidor (service role) |

Rol `agenda` (solo calendario): lo mismo que cualquier miembro (nombre de la clínica, equipo, servicios,
profesionales, horario y ausencias, suscripción, sus tickets) más `agenda_calendar` (horas, estado, servicio
y **código** del paciente). Nada de pacientes, citas directas, notas, documentos, facturas ni gastos. No escribe.

Nadie puede: cambiarse el rol o la administración a sí mismo, quitar la última administración, editar el
estado de la cuenta o la suscripción por REST, leer el token de una invitación, modificar una factura
emitida, una nota firmada o una entrada de auditoría, ni ver datos de otra clínica.

## 5. Códigos de error propios (SQLSTATE)

| Código | Significado |
|---|---|
| KS001 | Cuenta suspendida o cerrada: solo lectura |
| KP001 / KP002 | Límite del plan alcanzado / bajada de plan por debajo del uso actual |
| KP003 / KP004 | El cambio de un plan de pago va por la pasarela / sin suscripción |
| KT001…KT006 | Equipo: ya es miembro, invitación no pendiente, token no válido o caducado, correo distinto, no puedes quitarte la administración, última administración |
| KO001 / KO002 | Alta: correo sin confirmar / máximo 3 clínicas creadas por cuenta |
| KB001 / KB002 / KB003 | Cobros: factura no emitida / cobro mayor que lo pendiente / solo borradores |
| KD001 / KD002 / KD003 | Documentos: ruta no válida / campo inmutable / ya retirado |
| 23P01 | Solapamiento (citas o franjas de horario) |
| KN0xx | Reglas clínicas (ver `clinical-db/README.md`) |

## 6. Cosas que se hacen a mano en un entorno real

- **Alta de personal de KOVO**: `INSERT INTO public.platform_admins(user_id, note)` con la clave de servicio o
  desde el editor SQL. No hay forma de hacerlo desde el navegador (probado).
- **Recarga de PostgREST** tras DDL: `NOTIFY pgrst, 'reload schema'`.
- **Configuración de Auth** coherente con las pruebas: contraseña mínima 10, rotación de refresh tokens
  activada con reutilización 0, confirmación de correo activada en producción (necesita SMTP).
