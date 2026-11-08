# Modo Supabase: escritura de pacientes y citas

En modo Supabase (`VITE_DATA_MODE=supabase`) KOVO guarda en la BD las **altas y modificaciones de pacientes
y citas**, y los **cambios de estado de las citas**. Nada más: el resto de acciones de la interfaz siguen
cambiando solo la memoria (ver "Fuera de alcance"). El modo demo no cambia; el modo Supabase sigue
desactivado por defecto.

## Arquitectura

No hay sincronización del estado completo (`persist()` no hace nada). Cada acción de la interfaz hace
**una** operación explícita:

```
legacy.js (manejador)        valida el formulario como siempre (nombre, email, solapes…)
 └─ data.writes.*            legacy-writes.js: formulario legacy → fila de la BD
     └─ writer.*             writes.js:
          1. valida la fila (columnas permitidas, tipos, valores de los CHECK, fechas)
          2. comprueba la consulta (UUID) y fuerza org_id
          3. comprueba el rol (copia de las políticas RLS; la BD lo vuelve a comprobar)
          4. POST o PATCH, filtrado por org_id, con Prefer: return=representation
          5. valida y devuelve la fila confirmada
     ← objeto legacy construido desde la fila confirmada (from-supabase.js + legacy-state.js)
 └─ applyPatient / applyAppointment   el estado S cambia SOLO aquí, tras la confirmación
```

Un error de red, un HTTP de error, una respuesta vacía o una fila de otra consulta lanzan `WriteError` y el
manejador muestra el mensaje **sin tocar el estado**. El formulario queda abierto para reintentar. Mientras
hay una escritura en curso, el botón se desactiva y no se aceptan otras.

### Operaciones

| Acción en la interfaz | Operación | Petición |
|---|---|---|
| Nuevo paciente | `savePatient` sin `existing` | `POST patients` |
| Editar paciente | `savePatient` con `existing` | `PATCH patients?id&org_id&updated_at` |
| Nueva cita | `saveAppointment` sin `existing` | `POST appointments` |
| Reprogramar cita | `saveAppointment` con `existing` | `PATCH appointments?id&org_id&updated_at` |
| Confirmar / Realizada / Ausencia / Cancelar / Rellenar informe (marca realizada) | `setAppointmentStatus` | `PATCH appointments` (solo `status`) |

### Correspondencia formulario → columnas

**Paciente.** `name` → `first_name` + `last_name` (`splitName`); `email`, `phone`; `status = 'active'` en el
alta (en la edición no se toca). `service`, `modal`, `billing`, `reminders` y `alta` van a `profile_data`,
**fusionados** con lo que ya hubiera. El **código lo asigna PostgreSQL** (trigger `patients_assign_code`,
formato `P-00001`): el navegador no lo envía.

**Cita.** `patientId` → `patient_id`; `date` + `start` (hora de Madrid) → `starts_at` en UTC, sin depender de
la zona horaria del navegador; `+ dur` → `ends_at`; `service` → `service_id` (null si es el servicio de
presentación); `price` → `price_cents`; `modal` → `modality`; `loc` → `location`; `notes` →
`administrative_note`; `S.pro.id` → `professional_id`; usuaria → `created_by`. Estados:
`pendiente`↔`scheduled`, `confirmada`↔`confirmed`, `realizada`↔`completed`, `ausencia`↔`no_show`,
`cancelada`↔`cancelled`. Una hora que no existe por el adelanto de marzo se rechaza; la hora repetida de
octubre se toma como la de invierno.

### Identificadores

- Todo registro de la BD se identifica por su **UUID**. Los altas generan el UUID en el navegador.
- Un registro con id de la demo (`p12`, `a40`…) se da de alta con ese id en **`legacy_id`** (índice único
  `(org_id, legacy_id)`). Si ya estaba importado, se reutiliza el existente en lugar de duplicarlo. Al
  confirmarse, el id local se sustituye por el UUID y se actualizan las referencias (`appts.patientId`,
  `notes.patientId`, `invoices.patientId`, `notes.apptId`, la ficha abierta).

### Reintentos sin duplicados

- **Altas:** el UUID se genera una vez por formulario y se reutiliza en cada reintento. Si la primera
  petición llegó pero se perdió la respuesta, el reintento recibe "duplicado" (`23505`), lee la fila por id y
  la da por confirmada. Si entre intentos se cambió el formulario, aplica los valores nuevos con un PATCH.
  Abrir un formulario nuevo genera un UUID nuevo.
- **Cambios:** el PATCH lleva la versión cargada (`updated_at=eq.…`). Si ninguna fila coincide, se lee la
  fila: si ya tiene esos valores, era un reintento y se confirma; si otra persona la cambió, se rechaza como
  **conflicto** y no se pisa su cambio; si no existe (o la RLS la oculta), "no existe o sin permiso".
- **Sesión caducada (401):** se renueva el token una vez (`refreshAccessToken`) y se repite la misma
  petición, que es idempotente. Si no se puede renovar: error de sesión, nada guardado.

### Permisos y organización

| | psychologa | recepcion | gestoria |
|---|:-:|:-:|:-:|
| Alta / modificación de pacientes | ✓ | ✓ | ✗ |
| Alta / modificación / estados de citas | ✓ | ✓ | ✗ |

Copia de las políticas `patients_insert/update` y `appointments_insert/update`. El cliente rechaza antes de
enviar; la BD vuelve a comprobarlo (403/`42501` → error de permiso; un UPDATE sin permiso no encuentra filas).
`org_id` no se acepta desde el cliente: siempre es la consulta de la sesión, y todos los PATCH filtran por
ella. La BD impide citar a un paciente, profesional o servicio de otra consulta (claves foráneas compuestas
`(org_id, id)` → `invalid_reference`).

### Errores (`WriteError.code`)

`validation`, `forbidden`, `auth`, `network`, `http`, `duplicate`, `invalid_reference`, `conflict`,
`not_found`, `unexpected_response`. Mensajes en español, sin datos personales; los de red dicen
explícitamente que **no se ha guardado**.

## Cambios en legacy.js

Solo en modo Supabase (`W = data.writes`; en demo es `null` y el código anterior se ejecuta igual —
verificado con las 20 capturas de la prueba visual, idénticas píxel a píxel antes y después):

- `savePatient`, `saveAppt`, `confirm`, `done`, `noshow`, `cancelAppt`, `fillNote` esperan la confirmación y
  después aplican el registro, auditan, cierran el modal y muestran el aviso.
- En el formulario de paciente nuevo el código se muestra como `····`: lo asigna PostgreSQL al guardar.
- No se generan los avisos por email simulados de la demo (en este modo no se envía nada).
- Al marcar una sesión como realizada **no se crea factura** (ver "Fuera de alcance").

## Limitaciones de esta fase

1. **Motivo de cancelación e historial de la cita** no tienen columna: se ven hasta recargar y se pierden.
2. **Solapes de citas:** solo los comprueba la interfaz. La BD no tiene restricción de exclusión, así que dos
   personas a la vez pueden reservar el mismo hueco. *Necesita migración* (`EXCLUDE USING gist` por
   profesional y rango, salvo canceladas).
3. **`updated_at` lo pone el navegador:** la BD no tiene trigger. Sirve como versión, pero la hora depende del
   reloj del equipo. *Necesita migración* (trigger `BEFORE UPDATE` que ponga `now()`).
4. **Email no único en la BD:** el duplicado se comprueba solo con los pacientes cargados.
5. **Estado `nuevo`** no existe en la BD: el paciente recién creado aparece como `activo`.
6. **Código `P-00001`:** la interfaz habla de "código de 4 dígitos" en algún texto.
7. **Notas clínicas:** los borradores se guardan desde T2C (ver [notas.md](notas.md)); firmar y rectificar, todavía no.
8. **Consentimiento y documentos:** la subida a Storage no está implementada.
9. La interfaz no avisa de que el resto de acciones (gastos, facturas, ajustes…) no se guardan.

## Fuera de alcance y qué lo bloquea

| Funcionalidad | Bloqueo |
|---|---|
| **Eliminar pacientes o citas** | `authenticated` no tiene permiso `DELETE` ni política de borrado en `patients`/`appointments`. Hay que decidir baja lógica (`archived` / `cancelled`) frente a borrado, por la obligación de conservar la historia clínica (mínimo 5 años, Ley 41/2002) y la auditoría. La interfaz tampoco tiene la acción. |
| **Emisión automática de facturas** | La BD no relaciona citas con facturas (ni `appointment_id` en líneas ni `invoice_id` en citas): sin eso se facturaría dos veces. `save_invoice_draft` no guarda destinatario (nombre, NIF, dirección). La exención de IVA depende de la habilitación sanitaria del profesional, que no está en la BD. La numeración real (`KOVO-AAAA-000001`) no coincide con la de la interfaz (`A2026/0001`) ni con su cadena de hashes. |
| **Escritura de notas clínicas firmadas** | Las RPC existen (`save_clinical_note_draft`, `sign_clinical_note`, `rectify_clinical_note`), pero el contenido es un texto y la interfaz trabaja por apartados: el formato `clave: valor` es ambiguo. Hace falta un formato estructurado (JSON) o columna por apartado. `save_clinical_note_draft` solo deja editar borradores propios (`author_id = auth.uid()`), y no hay relación usuaria → profesional para mostrar autorías. Las notas firmadas son inmutables (trigger), así que un error de formato no se podría corregir después. |
| **Sincronización de facturación** | Facturas y líneas son inmutables tras emitirse (triggers). No hay RPC para cobros, ni columnas de destinatario, envío o hash. Depende de la relación cita ↔ factura anterior. |
| **Migraciones de producción** | El historial de migraciones no coincide con la BD real (ver `supabase/recovered-schema/MIGRATION_RECONCILIATION_PLAN.md`): hay que reconstruir la base y probarla en un Supabase local antes de añadir ninguna (incluidas las de los puntos 2 y 3). |

## Pruebas

```
npm run test:unit          # tests/unit/writes.unit.mjs (+ lectura): servidor simulado en memoria
sh scripts/pw.sh supabase  # tests/supabase/escrituras.spec.js: la interfaz real escribiendo
```
El servidor simulado (`tests/fixtures/supabase-fake.mjs`, `createFakeServer`) aplica las reglas de la BD real:
RLS de escritura por rol, claves primarias, índice `legacy_id`, claves foráneas compuestas, CHECK de estados
y fechas, y el trigger del código de paciente. Puede simular un corte de red antes de escribir, una
respuesta perdida después de escribir y un token caducado.
