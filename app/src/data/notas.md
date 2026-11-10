# Modo Supabase: borradores de notas clínicas

En modo Supabase la psicóloga puede **crear y editar borradores** de notas clínicas (nota de sesión,
evaluación inicial, informe de evolución, informe de cierre) y se guardan en `clinical_notes`. **Firmar,
rectificar y borrar** quedan fuera de esta fase. El modo demo no cambia (20/20 capturas idénticas píxel a
píxel antes y después).

Código: `note-writes.js` (escritor y adaptador para `legacy.js`). Pruebas: `tests/unit/notes.unit.mjs` y
`tests/supabase/notas.spec.js` (v1), `tests/unit/notes-v2.unit.mjs`, `tests/supabase/notas-v2.spec.js` y
`tests/real/notas-real.spec.js` (v2).

> **T2D (10/11/2026):** existe una propuesta SQL **v2** validada en PostgreSQL + PostgREST reales y
> locales (`clinical-db/`), con UUID estable, versión, integridad en la BD y auditoría. El cliente usa la
> v2 si la BD la tiene y, si no, esta v1. Arquitectura, permisos, pruebas por categoría y pendientes:
> **`clinical-db/README.md`**. Este documento describe la **v1**, la única que existe hoy en producción.

## Qué permite la BD (esquema real)

| | |
|---|---|
| Tabla | `clinical_notes(id, org_id, patient_id, appointment_id?, author_id?, note_type, content text, status, signed_at?, created_at, updated_at)`. `status` ∈ draft / signed / rectified. `note_type` sin CHECK. Sin `legacy_id`. |
| Permisos | `authenticated` solo tiene **SELECT** (política `clinical_notes_psychologist_read`: rol psychologa). No hay INSERT ni UPDATE directos. |
| Escritura | `save_clinical_note_draft(p_org_id, p_patient_id, p_appointment_id, p_note_type, p_content, p_note_id)`, SECURITY DEFINER. Exige psychologa en la consulta (42501) y contenido no vacío. Sin `p_note_id` **inserta** un borrador (id elegido por el servidor, `author_id = auth.uid()`). Con `p_note_id` actualiza `content` y `note_type` **solo** si el borrador es de esa consulta, de la misma autora y sigue en draft. Devuelve el uuid. |
| Claves foráneas | `(org_id, patient_id) → patients`, `(org_id, appointment_id) → appointments`: paciente y cita deben ser de la misma consulta. |
| Inmutabilidad | Trigger `clinical_notes_immutable`: una nota signed o rectified no se puede modificar ni borrar. |
| Otras RPC (no usadas) | `sign_clinical_note`, `rectify_clinical_note`, `delete_clinical_note_draft` (solo borradores propios). |

## Cómo se guarda

```
editor (legacy.js)   copia de trabajo de la nota (NB); S.notes no se toca al escribir
 └─ saveNote         data.writes.notes.saveNote({ note, fields, knownIds })
     └─ saveDraft    note-writes.js:
          1. valida ids y apartados; convierte los apartados al texto de la BD (ver Formato)
          2. contexto: consulta (UUID), rol psychologa y usuaria identificada
          3. lee el paciente y, si hay cita, la cita, filtrando por la consulta;
             comprueba que la cita es de ese paciente
          4. edición: lee la nota y comprueba que es borrador, de esta autora, de ese paciente y cita,
             y que nadie la cambió en otra sesión (updated_at)
          5. UNA llamada a la RPC
          6. lee la fila y comprueba que coincide con lo enviado (consulta, paciente, cita, autora,
             borrador, tipo y contenido)
 └─ applyNote        solo entonces cambia S.notes y el editor pasa al UUID confirmado
```

Si algo falla: aviso en pantalla, **el texto sigue en el editor** y nada cambia en el estado. Los mensajes
son fijos y no incluyen contenido clínico; no se escribe nada en consola. Mientras se guarda, el botón se
desactiva. Lo que se escriba durante el guardado se conserva en el editor como cambio pendiente.

Al cerrar el editor con cambios sin guardar, se avisa y la copia de trabajo se mantiene en memoria (se
pierde al recargar). Un borrador nuevo **no aparece en las listas hasta que se guarda**.

**Firmar y cerrar** y **Guardar rectificación** siguen visibles (el diseño no cambia), pero en este modo
solo muestran un aviso y no cambian nada.

### Formato del contenido

Se usa el formato que ya existía (`mapping.clinicalNoteToRow` / `from-supabase.parseNoteContent`): un
apartado por bloque, `clave: valor`, separados por una línea en blanco. Se escriben **todos** los apartados
del tipo, en su orden (los vacíos como `clave: `). Antes de enviar se comprueba que el texto se vuelve a leer
exactamente igual. Si un apartado contiene, tras una línea en blanco, una línea que empieza como el título de
otro (`plan: …`), el guardado se rechaza con un aviso para no mezclar apartados.

Tipos: `sesion`→`session`, `inicial`→`initial`, `evolucion`→`progress`, `cierre`→`discharge`.

Un borrador antiguo sin apartados (texto libre) se muestra entero en el primer apartado. Al guardarlo,
pasa al formato por apartados con ese texto en el primero.

### Reintentos sin duplicados

- **Edición:** mismo UUID. Repetir el mismo contenido no vuelve a llamar a la RPC. Si se perdió la
  respuesta, el reintento reconoce su propio cambio y no lo toma por un conflicto.
- **Alta:** la RPC no acepta un id del cliente. Antes de reintentar un alta, se buscan en la BD los
  borradores de esta autora, paciente, cita y tipo que la sesión no conoce y cuyo contenido es el de un
  intento anterior. Si hay uno, es el nuestro: se reutiliza (y se actualiza si el formulario cambió). Si hay
  varios, se para y se pide recargar.
- **Sesión caducada (401):** se renueva una vez y se repite (la petición rechazada no se ejecutó). Si no se
  puede renovar: aviso, nada guardado y el texto sigue en el editor.

### Permisos

Solo `psychologa`. Recepción y gestoría no leen notas (RLS). Aunque cambien la vista con «Ver como», el
guardado se rechaza con el rol real de la sesión sin enviar nada, y la BD lo rechazaría igualmente (42501).
Solo la autora edita su borrador (igual que la RPC).

**La organización no se acepta del navegador como autorización.** El `p_org_id` que se envía sale de la
membresía de la sesión (`memberships` filtrada por la usuaria autenticada), nunca de la nota, del
formulario ni de la URL. Aun así la BD no se fía: la RPC exige `has_role(p_org_id, 'psychologa')` para
`auth.uid()`. Una consulta manipulada en el navegador se rechaza con 42501 (probado).


`WriteError.code`: `validation`, `forbidden`, `auth`, `network`, `http`, `invalid_reference`, `not_found`,
`not_editable`, `locked` (firmada o rectificada), `conflict`, `unexpected_response`.

## Limitaciones del esquema v1 (todas resueltas en la propuesta v2, que aún NO está aplicada)

1. **El alta no es idempotente en la BD.** `save_clinical_note_draft` no acepta un id propuesto al crear.
   La búsqueda previa al reintento lo cubre en la práctica, con un caso residual: si la primera petición
   sigue procesándose en el servidor cuando llega el reintento, no se encuentra y se crean dos borradores.
   *Cambio necesario:* que la RPC acepte un UUID de cliente al insertar (o una clave de idempotencia).
2. **La BD no comprueba que la cita sea del paciente.** La clave foránea solo exige la misma consulta. Se
   comprueba aquí leyendo la cita justo antes, pero entre esa lectura y el guardado queda una ventana.
   *Cambio necesario:* que la RPC o un trigger lo valide, o una clave foránea `(org_id, appointment_id,
   patient_id)`.
3. **Los borradores no se auditan.** No hay trigger de auditoría en `clinical_notes` y la RPC no escribe en
   `audit_log` (solo firmar y rectificar lo hacen). *Cambio necesario:* auditar alta y edición, sin contenido.
4. **La edición no lleva versión en la BD.** La RPC no recibe `updated_at`: la comprobación de conflicto es
   de cliente (leer y comparar) y queda una ventana mínima. Solo afecta a la misma autora en dos pestañas.
   *Cambio necesario:* parámetro de versión en la RPC.
5. **El formato por apartados vive en un campo de texto.** Una línea `clave: ` tras una línea en blanco es
   ambigua y se rechaza. *Cambio necesario (con revisión de requisitos clínicos):* contenido estructurado
   (JSON o columnas), antes de firmar notas, porque una nota firmada ya no se puede corregir.

## Otras limitaciones

- **Autoría:** la BD guarda `author_id`, no el nombre. La interfaz muestra la autoría vacía.
- **Tipo de nota desde una cita:** la interfaz decide «evaluación inicial» si el servicio es el de la demo
  (`s3`). En este modo los servicios son UUID, así que la nota de una cita es siempre «nota de sesión». Los
  informes de evaluación, seguimiento y cierre se crean desde la ficha o «Nuevo informe».
- **Historial del editor** («Borrador guardado»…) solo en memoria; no hay columna.
- **No se pueden borrar borradores:** existe `delete_clinical_note_draft`, pero la interfaz no tiene la
  acción y queda fuera de esta fase.
- **«Ver como»** deja a recepción abrir el editor vacío; no ve datos ni puede guardar.

## Pruebas

Las de esta página usan Supabase **simulado** (`tests/fixtures/supabase-fake.mjs`, con la RPC v1 y, con
`v2: true`, la v2). Las pruebas contra **PostgreSQL y PostgREST reales** (locales y desechables; sin Docker no
hay GoTrue) están en `clinical-db/` y se lanzan con `sh scripts/pw.sh real`. Resultados: `clinical-db/README.md` §9.

```
npm run test:unit          # notes.unit.mjs (38, v1) + notes-v2.unit.mjs (27) + el resto   — simulado
sh scripts/pw.sh supabase  # notas.spec.js (11, v1) + notas-v2.spec.js (8) + el resto      — simulado, interfaz real
sh scripts/pw.sh real      # pgTAP, HTTP, concurrencia y la interfaz contra PostgreSQL/PostgREST reales
sh scripts/pw.sh smoke     # demo
sh scripts/pw.sh visual    # demo: capturas, tolerancia 0 píxeles
```
