# KOVO · facturación: qué hace el sistema y qué debe validar una asesoría fiscal

Estado a 10/11/2026. **No es asesoramiento fiscal.** KOVO no decide criterios fiscales: aplica los que
la clínica elige y deja anotado lo que hay que validar.

## 1. Dos facturaciones separadas

| | Clínica → paciente | KOVO → clínica (suscripción) |
|---|---|---|
| Dónde vive | tablas `invoices`, `invoice_lines`, `payments`, `expenses` de cada clínica | `subscriptions`, `billing_provider_events` (solo estado); las facturas las emitiría la pasarela de pago |
| Quién emite | la clínica (emisor = su perfil fiscal) | el titular de KOVO |
| Estado | implementada y probada | **sin pasarela**: el webhook está preparado y probado con eventos firmados sintéticos, sin cobros reales; precios sin definir |

No comparten tablas, numeración ni permisos.

## 2. Facturas de la clínica: lo que hace el sistema

- **Borrador** editable (líneas, vencimiento, retención) → **emisión** → **cobros** (parciales o totales; estado pendiente / parcial / cobrada).
- **Numeración**: al emitir, `SERIE-AAAA-NNNNNN`. La serie la define la clínica en su perfil fiscal; el número sale de un contador por clínica que se reserva dentro de la misma transacción (sin huecos ni duplicados, probado con emisiones simultáneas). **El contador no se reinicia cada año** (el año va en el texto): validar si la clínica prefiere reiniciar por año o usar series distintas.
- **Inmutabilidad**: una factura emitida no puede modificarse ni borrarse (lo impide la base de datos). Los borradores sí se pueden descartar.
- **Instantáneas**: al emitir se copian los datos del emisor y del destinatario; cambios posteriores en las fichas no alteran facturas ya emitidas.
- **Datos del destinatario**: nombre y dirección obligatorios para emitir; NIF opcional.
- **Impuestos**: tipo por línea, la interfaz ofrece 0 % (exenta) o 21 %. **Retención IRPF**: porcentaje sobre la base, elegido en la factura.
- **Gastos**: solo importe total, concepto, fecha y categoría. Sin desglose de IVA, sin adjunto, sin proveedor.
- **Exportación**: PDF de factura y libros de ingresos / gastos en CSV (`;`), generados en el navegador con los datos cargados del servidor. No son libros registro oficiales.
- **Conciliación bancaria** (importar extracto): bloqueada en modo conectado; solo existe en la demo.

## 3. Puntos que debe validar la asesoría

1. **Exención de IVA** (art. 20.Uno.3.º Ley 37/1992): asistencia a personas físicas por profesionales sanitarios reconocidos. Validar qué servicios de cada clínica entran (terapia, evaluación) y cuáles no (formación, informes periciales, talleres, servicios a empresas). La app no lo decide: la clínica elige el tipo en cada línea.
2. **Mención de la exención** en la factura: el PDF y la vista de la factura ya imprimen «Operación exenta de IVA conforme al art. 20.Uno.3º de la Ley 37/1992» cuando hay líneas exentas. Validar el texto.
3. **Retención IRPF**: solo procede cuando el destinatario es empresa o profesional. Tipo general 15 %; tipo reducido en los primeros años de actividad; validar los casos de cada clínica. La app no lo calcula automáticamente.
4. **Numeración y series**: reinicio anual o no; serie distinta para rectificativas.
5. **Facturas rectificativas** (RD 1619/2012, art. 15): **no implementadas**. Hoy una factura emitida errónea no puede corregirse desde la app (el botón está bloqueado con un aviso). Bloqueante para uso real.
6. **Factura simplificada vs completa** para pacientes particulares.
7. **Sistemas de facturación verificables (Verifactu, RD 1007/2023)** y su calendario de obligatoriedad: confirmar con la asesoría qué obligaciones y fechas aplican. KOVO **no** genera registros de facturación encadenados ni envía nada a la AEAT. Si aplica, es bloqueante.
8. **Facturación electrónica entre empresas** (Ley 18/2022, cuando entre en vigor el desarrollo reglamentario): solo afecta a facturas a empresas.
9. **Conservación** de facturas y libros, y libros registro de IVA/IRPF: la app no genera libros oficiales.
10. **Modelos tributarios** (130, 111, 303, 347…): no se calculan ni se presentan.

## 4. Facturación de KOVO a las clínicas

- Planes Starter / Professional / Clinic con **límites provisionales** y **precios sin definir** (NULL). Prueba de 14 días.
- La pasarela de pago no está elegida. El webhook (`supabase/functions/billing-webhook`) espera eventos de suscripción firmados (`t=…,v1=…`), con `metadata.org_id` y `plan_code`; no está desplegado.
- La facturación al cliente (IVA de un servicio de software B2B, factura de la pasarela o propia) la define la asesoría del titular de KOVO.
