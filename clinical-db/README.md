# Módulo clínico de KOVO: borradores de notas (T2D)

Estado a 10/11/2026, rama `feat/clinical-notes-drafts` (solo local; nada publicado ni desplegado).

| Pieza | Estado |
|---|---|
| Interfaz y cliente (`app/`) | Hechos. Usan la RPC **v2** si la base de datos la tiene y, si no, la **v1** que existe hoy en producción. |
| Propuesta SQL v2 (`proposals/20261110_clinical_notes_v2.PROPOSAL.sql`) | Validada en **PostgreSQL 17 + PostgREST 16.5 reales y desechables**. **No aplicada** en ningún Supabase. No es una migración activa. |
| Firma, rectificación y borrado desde la interfaz | **Desactivados** (la interfaz los explica con un aviso). Ver «Pendiente antes de producción». |

## 1. Arquitectura

```
navegador (legacy.js, sin cambios de diseño)
 └─ editor de nota: trabaja SIEMPRE sobre una copia (NB); S.notes solo cambia con lo que confirma el servidor
     └─ data.writes.notes.saveNote                   app/src/data/note-writes.js
         ├─ v2: POST rpc/save_clinical_note_draft_v2  UUID del editor + versión esperada → fila confirmada
         └─ v1: POST rpc/save_clinical_note_draft     solo si la v2 no existe (PGRST202), una vez por sesión
PostgREST ──► PostgreSQL
              ├─ RLS: clinical_notes solo SELECT para psychologa de la consulta (sin INSERT/UPDATE/DELETE directos)
              ├─ RPC SECURITY DEFINER, search_path vacío, EXECUTE solo para authenticated
              └─ triggers (propuesta v2): integridad, versión, citas con nota, rectificaciones append-only, auditoría
```

Autorización: **siempre en PostgreSQL** (`private.has_role(org, roles)` con membresía activa y `auth.uid()`).
El cliente repite algunas comprobaciones solo para dar mensajes claros antes de llamar; nunca son la barrera.

## 2. Flujo

1. Psicóloga abre el paciente → citas → «Cerrar y rellenar informe»: la cita pasa a `completed` (PATCH real).
2. Se abre un borrador con un **UUID generado en el navegador** (estable en todos los reintentos).
3. Escribe; el indicador muestra «Sin guardar».
4. «Guardar borrador» → «Guardando…» → solo con la respuesta del servidor: «Guardado · versión N».
5. Al recargar, la nota se recupera desde la ficha (pestaña Sesiones), desde la cita («Continuar») o desde Informes.
6. Cada guardado posterior envía la versión que se editó. Si otra sesión guardó antes: **conflicto** (ver §6).

## 3. Modelo de datos (propuesta v2)

`clinical_notes` gana tres columnas, sin tocar las existentes:

| Columna | Uso |
|---|---|
| `version int ≥ 1` | La calcula un trigger (1 al crear, +1 en cada cambio real). El cliente nunca la fija. |
| `sections jsonb` | Apartados de la nota. Solo en `sections_v1`. |
| `content_format` | `legacy_text` (histórico, sin convertir) o `sections_v1`. |

`content` se sigue rellenando (lo deriva la BD de `sections`, mismo formato «clave: valor») para que firma,
rectificación y clientes antiguos sigan funcionando.

`clinical_note_section_catalog(note_type, section_key, label, position, active)` define los apartados
válidos por tipo. Los **activos** son exactamente los que la interfaz usa hoy. Los apartados del brief que
la interfaz aún no tiene (`evolucion`, `proxima_sesion`) están **inactivos**: activar uno es un cambio de
datos revisado más el campo en la interfaz, sin migración.

Vínculos guardados: organización, paciente, cita (opcional), autora (`author_id`), `created_at`,
`updated_at`, estado (`draft` / `signed` / `rectified`) y versión.

## 4. RPC y códigos de error

`save_clinical_note_draft_v2(p_note_id, p_org_id, p_patient_id, p_appointment_id, p_note_type, p_sections, p_expected_version)`
devuelve la fila completa.

- `p_expected_version = null` → crear con `p_note_id`. Si ya existe (respuesta perdida o reintento simultáneo),
  devuelve la misma nota (`ON CONFLICT`); nunca duplica.
- `p_expected_version = N` → editar la versión N. Si la guardada es otra: `KN005` y no se escribe nada,
  salvo que lo guardado sea idéntico a lo enviado (reintento ya aplicado), que devuelve la fila sin nueva versión.

| Código | Significado | Mensaje en la interfaz |
|---|---|---|
| 42501 | Sin rol psychologa activo en esa consulta | «Tu perfil no tiene permiso…» |
| KN001 | Paciente de otra consulta | «El paciente no pertenece a tu consulta.» |
| KN002 | Cita de otro paciente u otra consulta | «La cita no corresponde a este paciente…» |
| KN003 | Nota firmada o rectificada | «Esta nota está firmada…» |
| KN004 | No es la autora | «Solo quien creó este borrador puede editarlo.» |
| KN005 | Conflicto de versión (`details` = `{"current_version": N}`) | Aviso de conflicto (§6) |
| KN006 | No existe (también para ids de otra consulta: no se filtra nada) | «El borrador no existe…» |
| KN007 | Apartado desconocido/inactivo, valor no texto, demasiado largo | «La base de datos ha rechazado el contenido…» |
| KN008 | La cita no está realizada | «La cita todavía no está marcada como realizada…» |
| KN009 | El UUID ya es de otro paciente o cita | «El borrador no corresponde a este paciente o cita.» |
| KN010 / KN011 | Cita con nota: no cambia de paciente / sigue realizada | Mensaje en citas (`writes.js`) |
| KN012 | Nota con apartados guardada por la v1 | «Recarga la página.» |
| KN013 | Rectificaciones: solo se añaden | — |

Ningún mensaje incluye contenido clínico. Nada se escribe en consola.

## 5. Permisos (comprobados en PostgreSQL real)

| Rol | Pacientes / citas | Notas clínicas | Documentos privados | Auditoría |
|---|---|---|---|---|
| psychologa | Sí | Leer las de su consulta; crear y editar **sus** borradores | Sí | Leer la de su consulta |
| recepcion | Sí (administrativo) | No (ni leer ni RPC: 403) | No | No |
| gestoria | No | No | No | No |
| Membresía inactiva / sin membresía / anónimo | No | No | No | No |

Además: `org_id` manipulado → 403; filtros REST de otra consulta → 0 filas; INSERT/PATCH/DELETE directos
sobre `clinical_notes` o `audit_log` → 403; funciones de `private` no expuestas (404); token caducado o
con firma falsa → 401; un `service_role` falsificado no da acceso.

Decisión heredada de la RLS actual: **otras psicólogas de la misma consulta pueden leer** las notas (no
editarlas). Si se quiere restringir a la autora, es un cambio de política que requiere decisión clínica.

## 6. Versiones, conflictos y recuperación

- **Respuesta perdida al crear**: el reintento usa el mismo UUID → misma nota.
- **Respuesta perdida al editar y más texto antes de reintentar**: el servidor responde KN005; el cliente lee
  la nota y, si lo guardado es un intento suyo anterior, continúa desde esa versión (una vez). No hay falso conflicto.
- **Conflicto real** (otra pestaña u otro equipo): no se sobrescribe nada; el texto local se queda en el editor;
  aviso con «Ver versión guardada» (comparación por apartados), «Usar la guardada» (descarta el texto local)
  y «Guardar la mía» (guarda sobre la versión que se ha visto; si mientras tanto hubo otra, vuelve a avisar).
- **Corte de red / sesión caducada**: «NO se ha guardado», el indicador sigue en «Sin guardar», el texto se conserva;
  tras un 401 se renueva la sesión una vez.
- **Cerrar el editor** con cambios: se conservan en memoria y se avisa. **Salir de la página** con cambios: aviso del navegador.
- **No se guarda texto clínico en el navegador** (ni localStorage ni sessionStorage): un borrador no guardado
  se pierde si se cierra la pestaña ignorando el aviso. Decisión de privacidad deliberada.

## 7. Auditoría (triggers de la propuesta)

`audit_log` recibe una fila por alta, modificación, borrado autorizado, firma y rectificación con: consulta,
usuaria (`auth.uid()`), fecha, id de la nota, versión anterior y nueva, estado, tipo, paciente, cita y los
**nombres** de los apartados que cambiaron. **Nunca el contenido.** Un guardado idéntico no genera fila.
La firma ya no duplica la fila de auditoría (antes la escribía la RPC y ahora el trigger).

## 8. Integridad (triggers de la propuesta, para cualquier vía de escritura)

- Paciente y cita de la misma consulta, cita del mismo paciente (`FOR SHARE`: un cambio simultáneo de la cita espera).
- Solo se enlaza una nota a una cita **realizada** (KN008).
- Organización, paciente y cita de una nota no cambian; la autoría tampoco.
- Una cita con nota no cambia de paciente ni deja de estar realizada (KN010/KN011).
- Notas firmadas inmutables (trigger existente); rectificaciones append-only; firmar solo la autora y sin cambiar la autoría.

## 9. Pruebas por categoría y resultados (10/11/2026)

| Cat. | Suite | Dónde | Resultado |
|---|---|---|---|
| A | Unitarias con simulador (v1 38 + v2 27 + resto) | `npm run test:unit` | **189/189** |
| B | Navegador, modo Supabase simulado (v1 11 + v2 8 + resto) | `sh scripts/pw.sh supabase` | **29/29** |
| B | Humo (demo) | `sh scripts/pw.sh smoke` | **1/1** |
| B | Visual (demo, tolerancia 0 px; referencia = commit anterior) | ver nota | **20/20** |
| C | pgTAP clínico, con y sin la propuesta backend | `run-local.mjs` | **81/81** y **81/81** |
| C | pgTAP backend (43) antes de la propuesta clínica | `run-local.mjs` | **43/43** |
| C | pgTAP backend con la propuesta clínica | `run-local.mjs` | Original: se detiene en KN008 (esperado, §11). Fixture adaptado en memoria: **43/43** |
| D/E | HTTP: PostgREST real + JWT HS256 firmados en local | `run-local.mjs` | **51/51** |
| F | Concurrencia: sesiones intercaladas con bloqueos reales y ráfagas HTTP | `run-local.mjs` | **18/18** |
| B/D | Interfaz real en el navegador contra PostgREST + PostgreSQL reales | `run-local.mjs --e2e` | **1/1** (flujo completo, conflicto, corte de red, roles, auditoría) |

Prueba de mutación: quitar `ON CONFLICT` de la RPC hace fallar la suite F (23505); quitar el trigger de
integridad, la comprobación de versión, la de autoría, el bloqueo de citas o meter contenido en la auditoría
hace fallar la suite C.

Nota visual: las capturas guardadas en Git difieren 3 px de alto de la versión actual desde el cambio de
fuente de T1 (todas las pantallas, también sin tocar). La regresión se comprueba generando la referencia con
el `legacy.js` del commit anterior y comparando; después se restauran las capturas de Git.

## 10. Validación local (sin Docker ni Supabase CLI)

```
sh app/scripts/pw.sh real           # = node clinical-db/run-local.mjs --e2e
node clinical-db/run-local.mjs      # sin el navegador
node clinical-db/run-local.mjs --serve   # deja PostgREST levantado al final (Ctrl+C borra la BD)
```

- Herramientas en `app/.tools` (excluido de Git): PostgreSQL 17.11 embebido (npm `embedded-postgres`) + `pg`,
  PostgREST 16.5 (binario oficial), pgTAP 1.3.4 (instalado como extensión en ese PostgreSQL), Node 22.
- El esquema se lee con `git show` (solo lectura) de `origin/chore/recover-supabase-migrations`
  (`BASELINE_CANDIDATE_NOT_TESTED.sql`) y `origin/docs/backend-gap-design` (`PROPOSAL_ONLY_20261108.sql` y su pgTAP).
  No se copia ni modifica nada de esas ramas.
- `local/supabase-shim.sql` recrea lo mínimo de Supabase: roles, `auth.uid()` desde los claims del JWT, `storage.*`.
- Todo vive en un directorio temporal que se borra al terminar. El script se niega a arrancar si hay
  variables de un Supabase alojado en el entorno.

## 11. Limitaciones y bloqueos

1. **Supabase Auth (GoTrue) y Storage API no probados.** Sin Docker no se pueden levantar. Los JWT se firman
   en local con el mismo formato (HS256, `role`, `sub`, `aud`) y la interfaz recibe la usuaria de un Auth simulado.
   La suite HTTP del CI (`scripts/test-backend-postgrest.mjs`, con usuarios reales de GoTrue) solo corre en
   GitHub Actions, y eso exige subir la rama (no permitido en esta fase).
2. **La propuesta v2 no está aplicada en producción.** Hasta entonces la app usa la v1: alta no idempotente en la BD
   (lo cubre la búsqueda del borrador perdido, con una ventana residual), relación cita↔paciente comprobada por el
   cliente, conflicto detectado por el cliente, borradores sin auditar.
3. **Incompatibilidad con la suite pgTAP de la propuesta backend:** su fixture enlaza una nota a una cita programada,
   que la regla KN008 prohíbe. Si se adopta la regla, hay que ajustar ese fixture (cambio en otra rama, no hecho).
4. **Historial de migraciones de producción sin reconciliar** (fuera de alcance por instrucción expresa).
5. **Códigos de paciente:** el contador de la consulta solo avanza con códigos `AUTO`. Pacientes importados con
   un código `P-xxxxx` explícito harían chocar las altas siguientes. Revisarlo antes de importar datos.
6. Ver también `app/src/data/notas.md` (autoría sin nombre, tipo de nota desde una cita, historial en memoria).

## 12. Pendiente antes de producción

1. Reconciliar el historial de migraciones (`supabase/recovered-schema/MIGRATION_RECONCILIATION_PLAN.md` en `origin/chore/recover-supabase-migrations`) y convertir la propuesta en una
   migración revisada, aplicándola primero en un proyecto de staging.
2. Ejecutar `run-local.mjs` y el CI del backend contra ese staging con GoTrue real.
3. Ajustar el fixture backend (§11.3) o decidir no exigir cita realizada.
4. Antes de activar la firma: revisión clínica de los apartados, firma solo por la autora (ya en la propuesta),
   pruebas de inmutabilidad en la interfaz y política de rectificación. Antes de activar el borrado: decidir quién
   y cuándo puede borrar (hoy solo la autora y en borrador, auditado).
5. Revocar el token de GitHub expuesto en una conversación anterior.

## 13. Decisiones de diseño

- **Nota solo en cita realizada**: la interfaz ya marcaba la cita como realizada antes de abrir la nota; la BD lo garantiza.
- **Catálogo de apartados en tabla** y apartados nuevos inactivos: no se inventan campos clínicos sin revisión.
- **Sin conversión automática del histórico**: una nota `legacy_text` solo pasa a apartados cuando una psicóloga la guarda.
- **`content` derivado** para no romper la firma, la rectificación ni clientes antiguos.
- **Versión calculada por la BD** y comparación en la RPC bajo `FOR UPDATE`: el cliente no puede falsificarla.
- **Vuelta automática a la v1** solo si la v2 no existe al empezar; si la v2 ya se usó, un fallo no cambia de RPC en silencio.
- **Sin texto clínico en el navegador** fuera de la memoria de la pestaña.
- **Diseño intacto**: en modo demo nada cambia; en modo Supabase se añaden un chip de estado y un aviso con clases existentes.
