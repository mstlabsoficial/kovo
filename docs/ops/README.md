# KOVO · operación (entornos, secretos, CI/CD, despliegue, copias, monitorización)

Estado a 10/11/2026. Este documento describe **cómo debe operarse** KOVO. Salvo lo marcado como
«probado», son procedimientos preparados que todavía no se han ejecutado en un entorno real.

## 1. Entornos

| Entorno | Qué es | Datos | Estado |
|---|---|---|---|
| DEMO | GitHub Pages (`deploy-pages.yml`, rama `migracion-vite`), modo demo, todo en el navegador | ficticios | En marcha. No conecta con ningún servidor; no incluye `admin.html`. |
| LOCAL | `node db/run.mjs --serve` (sin Docker) | sintéticos, se borran al parar | Probado |
| CI | `kovo-ci.yml`: `supabase start` en Docker, se crea y destruye en cada ejecución | sintéticos | Preparado, **no ejecutado** (requiere subir la rama) |
| STAGING | Proyecto Supabase separado (UE), mismo esquema que producción | sintéticos o anonimizados, nunca reales | **No existe**. Hay que crearlo. |
| PRODUCCIÓN | Proyecto Supabase actual (UE) | reales | Tiene el esquema antiguo (006–008). **No se ha aplicado nada de esta rama.** |

Regla: cada entorno tiene su propio proyecto, claves y secretos. Nunca se comparten claves entre entornos.

## 2. Secretos

| Secreto | Dónde vive | Quién lo usa | Nunca |
|---|---|---|---|
| URL + clave publicable (anon) | variables de build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) | navegador | — (son públicas por diseño; la seguridad es RLS) |
| Clave de servicio (`service_role`) | secretos de Supabase (Edge Functions) y gestor de contraseñas del equipo | webhook de pagos, operaciones manuales | en el navegador, en Git, en logs |
| Contraseña de la base de datos | gestor de contraseñas | migraciones aprobadas, copias | en Git, en CI salvo entorno protegido |
| `BILLING_WEBHOOK_SECRET` | secretos de la Edge Function | `billing-webhook` | en Git |
| SMTP (correo de Auth) | panel de Supabase › Auth | confirmación y recuperación de contraseña | en Git |
| Token de acceso de Supabase CLI / GitHub | gestor de contraseñas personal | despliegues aprobados | en chats, en Git, en el código |

`.env*` está ignorado en Git (T1). `clinical-db/local/env.mjs` se niega a ejecutarse si encuentra
variables de un proyecto alojado. **Pendiente del responsable**: revocar el token de GitHub que se expuso
en una conversación anterior y crear uno nuevo con permisos mínimos.

## 3. CI/CD

- **CI** (`.github/workflows/kovo-ci.yml`), en cada push a `feat/kovo-consolidacion` y en PR hacia
  `migracion-vite`: unitarias, build demo y conectado, navegador con API simulada, smoke; base de datos
  y E2E contra Supabase local en Docker; simulacro `pg_dump`/`pg_restore`. Sin secretos, solo lectura.
- **CD de la demo**: sin cambios (`deploy-pages.yml`).
- **CD de la app conectada y de la base de datos**: **no automatizado a propósito**. Cada paso a staging
  o producción es manual y aprobado, con el procedimiento del §4.

## 4. Despliegue de la base de datos (cuando se apruebe)

Orden para STAGING (y después, igual, para PRODUCCIÓN):

1. Copia de seguridad verificada (§6) y ventana anunciada.
2. Comparar esquema real con el baseline (`pg_dump --schema-only`) y resolver diferencias.
3. Aplicar en orden: propuesta backend 20261108 → notas clínicas v2 → `db/migrations/*` (cada archivo en
   una transacción; parar al primer error).
4. `NOTIFY pgrst, 'reload schema'`.
5. Configurar Auth (contraseña ≥ 10, rotación de refresh tokens, reutilización 0, confirmación de correo, SMTP).
6. Ejecutar las pruebas de humo de `db/tests/http.mjs` contra STAGING con usuarios sintéticos.
7. Asignar plan a las clínicas existentes (decisión pendiente) y dar de alta al personal de KOVO.
8. Publicar la build conectada con las claves del entorno.

**Rollback**: las migraciones son aditivas (columnas, tablas, funciones y políticas nuevas); no borran ni
reescriben datos salvo la sincronización del contador de pacientes. El rollback seguro es **restaurar la
copia del paso 1** (el ensayo de restauración está probado, §6) y volver a publicar la build anterior.
No se preparan scripts `DOWN` por tabla: deshacer políticas de seguridad a mano es más arriesgado que restaurar.

## 5. Monitorización y logs

- Supabase: panel de uso, logs de API/Auth/Storage, alertas de tamaño de base de datos y de Storage.
- Errores del navegador: **no hay herramienta conectada** (decisión pendiente). Si se añade, configurarla
  sin capturar texto de la página, formularios ni URLs con parámetros.
- Webhook de pagos: registra tipo de evento y resultado, nunca el cuerpo. Los eventos fallidos quedan en
  `billing_provider_events.error`: revisarlos a diario.
- Auditoría: `audit_log` (clínica; solo nombres de campo, nunca valores) y `platform_audit_log` (acciones del personal de KOVO, con motivo).
- Regla general: **ningún log contiene datos personales ni clínicos** (nombres, correos, notas, importes por paciente).

## 6. Copias de seguridad y restauración

| Qué | Cómo | Probado |
|---|---|---|
| Base de datos (PostgreSQL) | Copias automáticas del plan de Supabase + PITR si el plan lo incluye; además `pg_dump -Fc` periódico cifrado a un almacenamiento en la UE | Restauración física en frío: **sí** (local, 70 tablas idénticas, contraseñas y documentos). `pg_dump`/`pg_restore`: preparado en CI, no ejecutado. |
| Ficheros de Storage | **No van en las copias de la base de datos.** Copia propia del bucket `kovo-patient-documents` (API de Storage o S3) cifrada, misma frecuencia | Local: sí (ficheros + hashes). En Supabase alojado: pendiente de definir herramienta. |
| Auth (usuarios, contraseñas) | Van en la base de datos (`auth` schema) | Sí (local) |

Objetivos propuestos (decisión pendiente): RPO 24 h (o minutos con PITR), RTO 4 h. Ensayo de
restauración en STAGING al menos trimestral, registrando fecha, duración y resultado.

## 7. Manual de operación

- **Alta de personal de KOVO**: SQL con la clave de servicio: `INSERT INTO public.platform_admins(user_id, note) VALUES ('<uuid>', 'motivo')`. Baja: `DELETE`. Recomendado: MFA obligatorio para estas cuentas (pendiente).
- **Suspender / reactivar una clínica**: `admin.html` (motivo obligatorio, queda en `platform_audit_log`). La clínica conserva la lectura y el soporte.
- **Soporte**: `admin.html` › Soporte. No pedir ni aceptar datos de pacientes en los mensajes.
- **Cambiar plan manualmente**: `admin.html` › Plan (con motivo). Con la pasarela activa, solo para corregir.
- **Recordatorios de citas**: se encolan en `appointment_reminders` (24 h antes). **No se envían**: falta el proveedor de correo/SMS y el proceso que vacía la cola.
- **Cierre de una clínica**: `platform_set_account_status(…, 'closed', motivo)`. Los datos se conservan (obligación de conservación de la historia clínica). La exportación y la entrega a la clínica son manuales hoy.
- **Petición de supresión de datos**: ver `docs/legal/README.md` (§ derechos). No borrar historia clínica sin revisar el plazo legal de conservación.
- **Incidente de seguridad**: ver `docs/legal/README.md` (§ brechas).
