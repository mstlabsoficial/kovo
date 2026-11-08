# Adaptador de lectura Supabase → modelo legacy

`from-supabase.js` convierte filas de Supabase (esquema en `src/types/database.types.ts`) en los objetos que
usa la interfaz legacy (`src/legacy.js`). Es solo de **lectura**: funciones puras, sin red, sin escrituras.
Todavía no lo usa ninguna pantalla; el modo demo no cambia.

```js
import { buildLegacyCollections } from './from-supabase.js';
const { collections, loaded, report } = buildLegacyCollections({
  patients, appointments, services, professionals, invoices, invoiceLines, payments,
  expenses, employees, clinicalNotes, rectifications, patientDocuments
});
// collections: { patients, appts, services, professionals, invoices, expenses, employees, notes }
// loaded: qué colecciones se recibieron (una colección ausente ≠ una colección vacía)
// report: [{ entity, id, field, issue, value? }] — sin datos personales ni clínicos
```

## Reglas

- **No se inventa nada.** Si un dato no existe en la BD, el campo queda `null` y se anota en `report`
  (`missing_in_db`). Las listas que la BD no registra (historial de cita, documentos de empleado) quedan `[]`.
- **Estados:** solo se traducen los valores con evidencia en el repositorio (los que escribe `mapping.js` o las
  migraciones). Cualquier otro valor queda `null` y se anota (`unknown_value`).
- **Ids:** se conservan los UUID reales. El id anterior de la demo, si existe, va en `legacyId`.
- **Fechas:** las marcas de tiempo se pasan a hora de **Europe/Madrid** (`date` `AAAA-MM-DD` y `start` en
  minutos). Las columnas `date` se conservan tal cual.
- **No cargado ≠ vacío:** si una colección relacionada no se pasa (por ejemplo, las líneas), el campo queda
  `null` y se anota `not_loaded`. Si se pasa vacía, queda `[]`.
- Campos adicionales del modelo relacional, que la interfaz ignora: `orgId`, `legacyId`, `professionalId`,
  `startsAt`, `storagePath`, `dbTotals`…

## Correspondencias

### Pacientes (`patients` + `patient_documents` → `S.patients`)
| Legacy | Supabase | Nota |
|---|---|---|
| `id` | `id` | UUID |
| `code` | `patient_code` | |
| `name` | `first_name` + `last_name` | El `-` que guarda `mapping.splitName` sin apellidos se omite |
| `email`, `phone` | `email`, `phone` | |
| `status` | `status` | `active`→`activo`, `inactive`→`alta terapéutica`. `nuevo` no existe en la BD |
| `alta` | `profile_data.alta` o fecha de `created_at` | Se anota si sale de `created_at` |
| `slot`, `service`, `modal`, `bi`, `billing`, `reminders` | `profile_data.*` | Solo si existen con el tipo correcto; si no, `null` |
| `consent` | `patient_documents` con `document_type` de consentimiento | El más reciente. `url: null` (hay `storagePath`) |
| `docs` | resto de `patient_documents` | `url: null` |
| — | `birth_date`, `address`, `emergency_contact`, `administrative_notes` | Extra: `birthDate`, `address`… |

### Citas (`appointments` → `S.appts`)
| Legacy | Supabase | Nota |
|---|---|---|
| `date`, `start` | `starts_at` | En hora de Madrid |
| `dur` | `ends_at − starts_at` | En minutos |
| `status` | `status` | `scheduled`→`pendiente`, `confirmed`→`confirmada`, `completed`→`realizada`, `cancelled`→`cancelada`, `no_show`→`ausencia` |
| `service` | `service_id` | |
| `modal`, `loc` | `modality`, `location` | |
| `price` | `price_cents` | |
| `notes` | `administrative_note` | |
| `log` | — | `[]`: la BD no guarda historial por cita |
| `cancelReason` | — | `null` |
| `invoiceId` | — | `null`: la BD no relaciona citas con facturas |

### Servicios y profesionales
| Legacy | Supabase |
|---|---|
| `service.dur`, `price`, `exempt` | `duration_minutes`, `price_cents`, `tax_exempt` (+ `active`) |
| `S.pro.name`, `col`, `email` | `professionals.display_name`, `professional_number`, `email` |
| `S.pro.nif`, `addr`, `loc`, `sanitaria` | — (`null`) |

### Facturas (`invoices` + `invoice_lines` + `payments` → `S.invoices`)
| Legacy | Supabase | Nota |
|---|---|---|
| `num`, `serie` | `invoice_number`, `series` | `kind` = `R` si la serie es `R` |
| `date`, `due` | `issue_date`, `due_date` | |
| `status` | `status` | Solo `draft`→`borrador`. Otros valores: `legacy_status` si es válido; si no, `null` |
| `lines[]` | `invoice_lines` | `desc`, `qty`, `price` = `unit_price_cents`, `exempt` = `tax_rate` 0 |
| `ret` (porcentaje) | `retention_cents` | Solo si es un porcentaje entero exacto; si no, `null` (y `retentionCents`) |
| `payments[]` | `payments` | `date` = `paid_at` en Madrid, `amount`, `method`, `ref` = `reference` |
| `to` | — | `null`: la BD no guarda destinatario |
| `appts`, `sent`, `hash`, `prevHash` | — | `[]` / `null` |
| — | `subtotal_cents`, `tax_cents`, `total_cents` | En `dbTotals`; se comparan con el cálculo de la interfaz |

### Gastos, empleados y notas clínicas
| Legacy | Supabase | Nota |
|---|---|---|
| gasto `total` | `amount_cents` | Se supone total pagado (sin verificar) |
| gasto `cat`, `concept`, `supplier`, `date` | `category`, `description`, `supplier`, `expense_date` | |
| gasto `base`, `iva`, `ret`, `nif`, `method`, `num`, `status`, `source`, `photo` | — | `null` (`document_path` → `documentPath`) |
| empleado `name`, `role` | `full_name`, `role_title` | + `email`, `active` |
| empleado `contract`, `start`, `bruto`, `docs` | — | `null` / `[]` |
| nota `type` | `note_type` | `session`→`sesion`, `initial`→`inicial`, `progress`→`evolucion`, `discharge`→`cierre` |
| nota `fields` | `content` | Inverso de `mapping.clinicalNoteToRow` (`clave: valor` separados por una línea en blanco) |
| nota `status` | `signed_at` / `status` | `signed_at` → `firmada`; `draft` → `borrador`; otros → `null` |
| nota `versions` | `clinical_note_rectifications` | Por fecha; `text` = `replacement_text`, + `reason` |
| nota `author` | `author_id` | `null`: la BD guarda el id de usuario, no el nombre (`authorId`) |

## Incompatibilidades detectadas

1. **Citas ↔ facturas:** la BD no las relaciona (`appts.invoiceId`, `invoice.appts`). Con datos reales,
   `unbilled()` vería todas las sesiones realizadas como **sin facturar**, con riesgo de facturar dos veces.
2. **Estados de factura:** solo `draft` está confirmado. Los que pone `private.emit_invoice` no están en Git;
   hasta conocerlos, las facturas emitidas quedan con `status: null`.
3. **Destinatario de factura** (`to`: nombre, NIF, dirección, empresa): no existe en la BD.
4. **Datos de agenda y facturación del paciente** (`slot`, `service`, `modal`, `billing`, `reminders`): no son
   columnas; solo existen si se guardan en `profile_data`. `mapping.patientToRow` no los guarda.
5. **Estado `nuevo` del paciente:** no existe en la BD (`active`/`inactive`).
6. **Notas clínicas:** la BD guarda un texto; la interfaz, apartados. Si el texto no sigue el formato
   `clave: valor`, se marca `structured: false`, se conserva en `content` y `fields` queda vacío. La interfaz
   mostraría la nota vacía: **no debe abrirse en el editor** hasta resolverlo. Un valor que contenga
   `\n\nclave: ` se reparte mal.
7. **Autor de nota y rectificación:** solo el id de usuario; no hay relación usuario → profesional.
8. **IVA:** la interfaz solo conoce 0 % y 21 %. Otros tipos se anotan (`unsupported_rate`).
9. **Retención:** la interfaz usa porcentaje y la BD céntimos; si no es un porcentaje entero exacto, `ret: null`.
10. **Gastos:** sin desglose (base, IVA, retención) ni método, número o estado. `amount_cents` se interpreta
    como total, sin verificar.
11. **Profesional:** faltan NIF, dirección fiscal, ubicación y habilitación sanitaria, que la interfaz usa en
    facturas y PDF.
12. **Documentos:** la BD guarda rutas de Storage, no URL. Hará falta un enlace firmado para verlos.
13. **Sin tablas** para nóminas, banco, avisos (`outbox`), obligaciones fiscales ni historial de citas.
14. **Vocabulario de `document_type`** sin verificar (`consent`, `consentimiento`, `informed_consent`).

**Campos que rompen la interfaz si llegan `null`** (a resolver antes de conectarla):
- `p.billing.type` (`markDone`, `billAll`)
- `SV(p.service).name` y `SV(a.service).name`
- `chip(e.status)` en gastos
- `i.to.name` en facturas sin paciente
- `i.lines.map` si las líneas no se cargaron

## Pruebas

```
node --test tests/unit/*.unit.mjs     # o: npm run test:unit
```
`tests/unit/from-supabase.unit.mjs` cubre:
- campos, estados y fechas (incluido el cambio de hora);
- nulos y campos opcionales;
- relaciones paciente–citas y factura–líneas–cobros, y referencias huérfanas;
- ida y vuelta con `mapping.js`;
- que el informe no contiene datos personales;
- que las copias de `FIELDS` y `CATS` siguen igual que en `legacy.js`.
