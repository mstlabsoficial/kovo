# Modo Supabase: carga de datos y correspondencias con el modelo legacy

El modo Supabase (`VITE_DATA_MODE=supabase`) ya carga datos reales de la consulta en la interfaz de
`legacy.js`. Es de **solo lectura**: no se escribe nada en la BD y los cambios hechos en pantalla se
pierden al recargar. Sigue **desactivado** por defecto; el modo demo no cambia.

## Flujo de `load()`

```
supabase.js  load({ today })
 ├─ authenticate()            sesión (auth.js) + membresía de ESTA usuaria → { id, name, is_demo, role }
 ├─ repository.loadSnapshot() solo GET, tablas que permite el rol, paginado, validado
 ├─ buildLegacyCollections()  from-supabase.js: filas → objetos legacy (null si la BD no lo tiene)
 └─ toLegacyState()           legacy-state.js: estado S completo + valores de presentación
```
`source.report()` devuelve las diferencias de la última carga: ids, campos y códigos, **sin datos
personales ni clínicos**.

### Tablas por rol

Copia de las políticas RLS de lectura (`supabase/recovered-schema/catalog-security.json`). La BD es la que
protege los datos; esta tabla evita pedir lo que el rol no puede ver y distingue "no cargado" de "vacío".

| Tabla | psychologa | recepcion | gestoria |
|---|:-:|:-:|:-:|
| services (también inactivos), professionals | ✓ | ✓ | ✓ |
| patients, appointments | ✓ | ✓ | |
| invoices, invoice_lines, payments, expenses | ✓ | | ✓ |
| employees, clinical_notes, clinical_note_rectifications, patient_documents | ✓ | | |

Rol de la BD → rol de la interfaz: `psychologa`→`psicologa`, `recepcion`, `gestoria`. Otro valor: error.

### Seguridad y errores

- Membresía filtrada por `user_id` (antes no lo estaba: la RLS deja ver todos los miembros de la consulta, así
  que se podía tomar el rol de otra persona o fallar con "varias consultas").
- Todas las consultas llevan `org_id=eq.<consulta>`; el id de la consulta se valida como UUID.
- Cada fila debe ser un objeto con `id` y con el `org_id` de la consulta; si no, la carga falla.
- Paginación de 500 filas, ordenada con `id` como desempate. Se para con una página **vacía** (no incompleta)
  para no truncar si el servidor limita filas; máximo 200 páginas por tabla. Filas repetidas: se quedan una vez.
- Todo o nada: si una tabla falla, no se muestra un estado parcial. Errores (`SnapshotError.code`):
  `network`, `auth` (401/403), `http`, `unexpected_response`, `forbidden`. Mensajes en español, sin datos personales.

## Reglas de conversión (`from-supabase.js`)

- **No se inventa nada.** Lo que la BD no tiene queda `null` y se anota (`missing_in_db`). Las listas que la BD
  no registra (historial de cita, documentos de empleado) quedan `[]`.
- **Estados:** se traducen los valores permitidos por las restricciones CHECK de la BD. Otro valor: `null` + `unknown_value`.
- **Ids:** UUID reales. El id anterior de la demo, si existe, va en `legacyId`.
- **Fechas:** las marcas de tiempo se pasan a hora de **Europe/Madrid** (`date` y `start` en minutos). Las columnas `date` se conservan.
- **No cargado ≠ vacío:** colección no recibida → `null` + `not_loaded`; recibida vacía → `[]`.

## Valores de presentación (`legacy-state.js`)

La interfaz falla con algunos `null` (`chip(null)`, `SV(null).name`, `i.to.name`…). Solo en este paso se
sustituyen por valores explícitos, y cada uno se anota como `ui_default` o `excluded_from_ui`. Nada de esto se
guarda en la BD.

| Caso | Valor mostrado |
|---|---|
| Cita o paciente sin servicio (o con uno no cargado) | servicio `kovo:sin-servicio` "Servicio sin asignar" |
| Paciente sin `profile_data.billing` | particular a su nombre, sin NIF ni dirección (como un paciente nuevo) |
| Factura sin destinatario | facturación del paciente si existe en la BD (`derived_from_patient_billing`, como `mkInv`); si no, su nombre o vacío |
| Retención que no es un % entero | porcentaje exacto que reproduce los céntimos de la BD |
| Gasto sin estado / sin categoría | `por revisar` / `Otros` |
| Nota sin apartados reconocibles | texto completo en el primer apartado de su tipo |
| Autor de nota o rectificación | `''` (la BD solo guarda el id de usuario) |
| Varios profesionales o ninguno | `S.pro` con nombre vacío (`ambiguous_professional` / `missing_in_db`) |
| Factura sin estado, nota sin tipo, cita sin fecha | no se muestra (`excluded_from_ui`); no se borra nada |
| Ajustes, disponibilidad | valores por defecto de `seed()` (la BD no los guarda) |
| Banco, nóminas, obligaciones pagadas, auditoría, avisos | `[]` / `{}` (no hay tablas) |

## Correspondencias

### Pacientes (`patients` + `patient_documents` → `S.patients`)
| Legacy | Supabase | Nota |
|---|---|---|
| `id`, `code` | `id`, `patient_code` | |
| `name` | `first_name` + `last_name` | El `-` que guarda `mapping.splitName` sin apellidos se omite |
| `email`, `phone` | `email`, `phone` | |
| `status` | `status` | `active`→`activo`, `inactive`→`alta terapéutica`, `archived`→`alta terapéutica` (aproximado, se anota) |
| `alta` | `profile_data.alta` o fecha de `created_at` | |
| `slot`, `service`, `modal`, `bi`, `billing`, `reminders` | `profile_data.*` | Solo con el tipo correcto; si no, `null` |
| `consent` | `patient_documents` de tipo consentimiento | El más reciente. `url: null` (hay `storagePath`) |
| `docs` | resto de `patient_documents` | `url: null` |
| — | `birth_date`, `address`, `emergency_contact`, `administrative_notes` | Extra: `birthDate`, `address`… |

### Citas (`appointments` → `S.appts`)
| Legacy | Supabase | Nota |
|---|---|---|
| `date`, `start` | `starts_at` | En hora de Madrid |
| `dur` | `ends_at − starts_at` | Minutos |
| `status` | `status` | `scheduled`→`pendiente`, `confirmed`→`confirmada`, `completed`→`realizada`, `cancelled`→`cancelada`, `no_show`→`ausencia` |
| `service`, `modal`, `loc`, `price`, `notes` | `service_id`, `modality`, `location`, `price_cents`, `administrative_note` | |
| `log`, `cancelReason`, `invoiceId` | — | `[]`, `''`, `null` |

### Servicios y profesionales
| Legacy | Supabase |
|---|---|
| `service.dur`, `price`, `exempt` | `duration_minutes`, `price_cents`, `tax_exempt` (+ `active`) |
| `S.pro.name`, `col`, `email` | `professionals.display_name`, `professional_number`, `email` |
| `S.pro.nif`, `addr`, `loc`, `sanitaria` | — (vacíos; `loc` la pone legacy.js por defecto) |

### Facturas (`invoices` + `invoice_lines` + `payments` → `S.invoices`)
| Legacy | Supabase | Nota |
|---|---|---|
| `num`, `serie` | `invoice_number` (`KOVO-AAAA-000001`), `series` | `kind` = `R` si la serie es `R` |
| `date`, `due` | `issue_date`, `due_date` | |
| `status` | `status` | `draft`→`borrador`; `issued`, `paid`, `partially_paid`→`emitida` (cobrada/parcial/vencida las calcula la interfaz con los cobros; se avisa si no cuadran); `void`→`rectificada` (aproximado) |
| `lines[]` | `invoice_lines` | `desc`, `qty`, `price` = `unit_price_cents`, `exempt` = `tax_rate` 0 |
| `ret` | `retention_cents` | Porcentaje |
| `payments[]` | `payments` | `date` = `paid_at` en Madrid, `amount`, `method`, `ref` |
| `to` | — | Ver valores de presentación |
| `appts`, `sent`, `hash`, `prevHash` | — | `[]` / `null` |
| — | `subtotal_cents`, `tax_cents`, `total_cents` | En `dbTotals`; se comparan con el cálculo de la interfaz |

### Gastos, empleados y notas clínicas
| Legacy | Supabase | Nota |
|---|---|---|
| gasto `total` | `amount_cents` | Se supone total pagado (sin verificar) |
| gasto `cat`, `concept`, `supplier`, `date` | `category`, `description`, `supplier`, `expense_date` | |
| gasto `base`, `iva`, `ret`, `nif`, `method`, `num`, `source`, `photo` | — | `null` (`document_path` → `documentPath`) |
| empleado `name`, `role` | `full_name`, `role_title` | + `email`, `active` |
| empleado `contract`, `start`, `bruto`, `docs` | — | `null` / `[]` |
| nota `type` | `note_type` | `session`→`sesion`, `initial`→`inicial`, `progress`→`evolucion`, `discharge`→`cierre` |
| nota `fields` | `content` | Inverso de `mapping.clinicalNoteToRow` (`clave: valor` separados por una línea en blanco) |
| nota `status` | `status` | `draft`→`borrador`; `signed`, `rectified`→`firmada`. `draft` con `signed_at` → `firmada` (se anota) |
| nota `versions` | `clinical_note_rectifications` | Por fecha; `text` = `replacement_text`, + `reason` |

## Incompatibilidades pendientes

1. **Citas ↔ facturas:** la BD no las relaciona. Con datos reales, `unbilled()` vería todas las sesiones realizadas
   como **sin facturar**: riesgo de facturar dos veces cuando se habiliten escrituras.
2. **Destinatario de factura** (nombre, NIF, dirección): no existe en la BD; se toma del paciente.
3. **Agenda y facturación del paciente** (`slot`, `service`, `modal`, `billing`, `reminders`): solo en `profile_data`,
   y `mapping.patientToRow` no los guarda.
4. **Estados sin equivalente exacto:** paciente `nuevo` no existe en la BD; `archived` y factura `void` se
   muestran de forma aproximada.
5. **Notas clínicas:** la BD guarda un texto; la interfaz, apartados. Un texto sin formato se muestra entero en el
   primer apartado; **no debe editarse y guardarse** hasta resolverlo. Un valor que contenga `\n\nclave: ` se reparte mal.
6. **Autor de notas y rectificaciones:** solo el id de usuario; no hay relación usuario → profesional.
7. **IVA:** la interfaz solo calcula 0 % y 21 %. Otros tipos se anotan (`unsupported_rate`).
8. **Gastos sin desglose** (base, IVA, retención, método, número): los resúmenes fiscales de Gestoría
   (modelos 130/303, libro de gastos) **no son fiables** en este modo.
9. **Profesional:** faltan NIF, dirección fiscal, ubicación y habilitación sanitaria (facturas y PDF salen sin ellos).
10. **Documentos:** rutas de Storage, no URL; hace falta un enlace firmado para verlos.
11. **Sin tablas** para nóminas, banco, avisos, obligaciones fiscales, ajustes, disponibilidad ni historial de citas.
12. **Vocabulario de `document_type`** sin verificar (`consent`, `consentimiento`, `informed_consent`).
13. **Recepción no lee documentos** (RLS): verá "Sin consentimiento" en pacientes que sí lo tienen.
14. **Servicios inactivos** se cargan (los usan citas antiguas) y la interfaz los ofrece en los selectores.
15. **Interfaz pensada para la demo:** el selector "Ver como" sigue visible (cambiar de rol solo muestra pantallas
    vacías: los datos no se cargan) y el pie dice "Prototipo con datos ficticios. Los cambios se guardan en este
    navegador", que no es cierto en este modo. Cambiarlo es un cambio de interfaz, fuera de esta tarea.
16. **Sin escritura:** `persist()` no hace nada. Las acciones de la interfaz cambian solo la memoria.

## Pruebas

```
npm run test:unit          # Node: tests/unit/*.unit.mjs (sin red)
sh scripts/pw.sh supabase  # interfaz real en modo Supabase con API simulada (sin red)
```
- `tests/unit/from-supabase.unit.mjs`: conversión de cada entidad, estados (los de los CHECK de la BD), fechas y
  cambio de hora, nulos, relaciones, duplicados, ida y vuelta con `mapping.js`, informe sin datos personales,
  copias de `FIELDS`, `CATS`, `CHIP` y `ME` sincronizadas con `legacy.js`.
- `tests/unit/load.unit.mjs`: tablas por rol (igual que la RLS), paginación con límite del servidor, consulta sin
  datos para cada rol, errores de red/401/403/500, respuestas inesperadas, filas de otra consulta, `load()` completo,
  valores de presentación y forma del estado frente a `seed()`.
- `tests/supabase/modo-supabase.spec.js`: cada rol carga y recorre todas sus secciones sin errores ni textos
  `null`/`undefined`/`NaN`; solo peticiones GET; nada de otra consulta; filtro por usuaria en la membresía; error
  de red con mensaje claro. Datos y API en `tests/fixtures/supabase-fake.mjs`.
