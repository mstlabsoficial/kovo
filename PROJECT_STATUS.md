# KOVO · estado del proyecto

Actualizado: 11/11/2026 · rama `feat/kovo-ui-v3` (subida hasta `2d23bba`; los commits posteriores son **locales**), sobre `feat/kovo-consolidacion` (subida) · base `migracion-vite`.

**Resumen:** la app funciona de principio a fin contra un Supabase real **local** (Auth, PostgREST,
Storage, PostgreSQL 17) con datos sintéticos y varias clínicas a la vez. **No está en producción ni en
staging**: nada de esta rama se ha aplicado a un proyecto alojado. No se puede vender todavía: ver §5.

Documentación: [`db/README.md`](db/README.md) (esquema, pruebas, matriz de permisos) ·
[`docs/ops/README.md`](docs/ops/README.md) (entornos, despliegue, copias) ·
[`docs/legal/README.md`](docs/legal/README.md) · [`docs/fiscal/README.md`](docs/fiscal/README.md).

## 0. Interfaz v3 (11/11/2026)

La interfaz es ahora la del prototipo v3 (`source/dist/KOVO-v3.html`; `Sesiona.html` queda como prototipo
anterior). La demo la muestra completa. En **modo conectado** todo lo que el prototipo añade y el servidor
todavía no guarda está oculto o bloqueado con aviso; nunca aparenta guardar (`tests/supabase/v3-bloqueos.spec.js`):

| Novedad de v3 | Demo | Conectado |
|---|---|---|
| Vacaciones y días cerrados | sí | **conectado** (`professional_time_off`, días completos de Madrid; los de la profesional de la sesión) |
| Mover una cita arrastrando | sí | **conectado** (misma escritura que «Reprogramar»; el solape lo rechaza la BD) |
| Citas repetidas (series) y cancelar serie | sí | **conectado** con la migración local `20261112090000_appointment_series` (todo o nada). **No aplicada en producción**: allí avisa de que falta la actualización |
| Diagnósticos y pruebas en la ficha | sí | **conectado** (`20261112090100`): solo psicóloga, se retiran sin borrarse, auditados; el archivo de la prueba va a Documentos |
| Gastos fijos mensuales y % deducible | sí | **conectado** (`20261112090200`): el servidor apunta los meses debidos sin duplicar; % deducible en los ajustes de la clínica |
| Perfil «solo calendario» | sí | **conectado** como rol `agenda` (`20261112090300`): se invita desde Ajustes › Equipo; ve horas, estado y código del paciente, nunca nombres ni datos clínicos; no escribe |
| Usuarios de ejemplo | sí | no aparecen; el equipo real está en Ajustes › Equipo |
| Dictado por voz y redacción con IA | simulado | desactivado: el contenido clínico no sale del navegador |
| Apartado «Recordatorio para la próxima sesión» y marca de riesgo en la nota | sí | no se ofrecen (no están en el catálogo de apartados del servidor) |
| Confirmación diaria por correo, respuesta del paciente | simulado | bloqueado (sin proveedor de correo) |
| Facturar sesiones («Facturar ya», «Facturar ahora») | sí | **conectado**: borradores enlazados a la cita; bloqueado con aviso si el servidor no tiene `invoice_lines.appointment_id` |
| Finalizar/reanudar terapia, exportar datos del paciente | — | **conectado** (exportación auditada en el servidor con `20261112090400`) |
| Ajustes para administración no psicóloga | — | **conectado** |

Las migraciones `20261112090000`–`0500` son **solo locales**: contra un servidor que no las tenga, esas funciones avisan de que falta la actualización y no guardan nada (comprobado con la suite del esquema antiguo y con pruebas unitarias de servidores sin las tablas/columnas).

## 1. Clasificación de funcionalidades

1 = implementada y validada (pruebas contra la pila Supabase real local; **no** en un entorno alojado) ·
2 = implementada, pendiente de validación · 3 = parcial · 4 = no implementada · 5 = bloqueada por dependencia externa.

### Pacientes
| Funcionalidad | Estado | Nota |
|---|---|---|
| Alta, edición, búsqueda | 1 | E2E + HTTP; edición probada con API simulada y en BD |
| Código de paciente sin colisiones | 1 | contador por clínica, 30 altas simultáneas, salta códigos importados |
| Conflicto de edición (no pisa cambios ajenos) | 1 | BD + navegador |
| Finalizar / reanudar terapia | 1 | botón en la ficha (psicóloga y recepción); `patients.status` inactive ↔ active con control de versión; avisa si quedan citas abiertas, no las cancela. Unitarias + E2E real |
| Archivar paciente (`archived`) | 3 | existe en BD; sin botón (se muestra como alta terapéutica) |
| Historial clínico (notas v2: borradores, versiones, conflictos, auditoría) | 1 | pgTAP 81 + E2E real |
| Firma y rectificación de notas | 3 | aplicadas en BD y probadas; **desactivadas en la interfaz** hasta validar firma electrónica |
| Documentos (subir, ver, retirar; PDF/JPG/PNG ≤ 20 MB; bucket privado) | 1 | E2E + HTTP (otra clínica, ruta manipulada, tipo, tamaño, sobrescritura) |
| Exportar todos los datos de un paciente | 1 | solo psicóloga; JSON generado en el navegador con lo ya cargado (ficha, citas, informes, pruebas, diagnósticos vigentes, facturas, lista de documentos); no pasa por ningún servidor. Los archivos de Documentos se descargan aparte. Cada exportación queda en la auditoría del servidor (quién, qué paciente, cuándo; solo recuentos) **antes** de descargarse: si no se puede registrar, no se exporta. Migración `20261112090400` (solo local). HTTP + E2E real |

### Agenda
| Funcionalidad | Estado | Nota |
|---|---|---|
| Vistas día/semana/mes, alta, edición, estados, cancelación | 1 | |
| Solapamientos | 1 | lo impide la BD (23P01), también con reservas simultáneas |
| Horario semanal del profesional | 1 | guardado atómico; solapes rechazados |
| Respetar el horario al citar | 3 | solo aviso en la interfaz; la BD no lo impone |
| Ausencias / vacaciones (días cerrados) | 1 | HTTP (RLS: profesional propia o administración; recepción solo lee) + E2E. Por profesional, no por clínica |
| Mover cita arrastrando | 1 | E2E |
| Citas repetidas y cancelar «esta y las siguientes» | 1 | HTTP + E2E; requiere la migración `20261112090000` (solo local) |
| Recordatorios | 3 | se encolan 24 h antes; **no se envían** (5: falta proveedor de correo/SMS) |

### Facturación de la clínica
| Funcionalidad | Estado | Nota |
|---|---|---|
| Borrador, edición, emisión con numeración correlativa, cobros parciales/totales | 1 | emisiones y cobros simultáneos probados |
| Perfil fiscal de la clínica y del paciente; instantáneas al emitir | 1 | |
| IVA exento/21 %, retención IRPF manual | 2 | funciona; **criterio fiscal por validar** (`docs/fiscal`) |
| Facturas rectificativas | 4 | botón bloqueado con aviso. Bloqueante |
| Enviar factura por correo | 5 | sin proveedor de correo |
| Facturar sesiones realizadas («Facturar ya» en la cita, «Facturar ahora» en Facturación) | 1 | solo psicóloga; crea **borradores** (no emite: la emisión la revisa ella y el criterio fiscal está pendiente). Cada línea va enlazada a su cita (`invoice_lines.appointment_id`): la BD impide facturar dos veces la misma sesión. Pacientes de empresa: una factura por paciente con todas sus sesiones. IVA según el servicio. E2E real. En esquemas sin la columna, la relación no se muestra |
| Gastos (alta, edición, borrado) | 3 | solo importe total; sin desglose de IVA ni adjunto. **Borrar no funciona**: la BD no da permiso de borrado a la clínica (heredado del baseline) |
| Gastos fijos mensuales | 1 | HTTP (permisos, idempotencia, llamadas simultáneas, mes borrado no se recrea) + E2E |
| Libros CSV, PDF | 2 | generados en el navegador; no son libros oficiales |
| Conciliación bancaria, nóminas, obligaciones fiscales | 4 | bloqueados con aviso en modo conectado |
| Verifactu / registro AEAT | 4 | pendiente de criterio fiscal |

### Equipo y clínica
| Funcionalidad | Estado | Nota |
|---|---|---|
| Invitaciones (enlace, caduca, correo debe coincidir, revocar) | 1 | el enlace se copia a mano: **no se envía por correo** (5) |
| Roles psicóloga / recepción / gestoría / solo calendario (`agenda`) + administración | 1 | matriz en `db/README.md`; sin autoescalada; última administración protegida |
| Datos de la clínica, ajustes, servicios y tarifas | 1 | |
| Ficha del profesional propio | 1 | |
| Alta de otros profesionales sin cuenta | 3 | la BD lo permite (administración); **sin interfaz** porque la agenda v3 es de una sola profesional: falta decidir y diseñar la agenda con varias profesionales (decisión 15) |
| Configuración accesible para administradores que no son psicólogos | 1 | en modo conectado, cualquier persona administradora abre Ajustes con las pestañas de la clínica (datos, equipo, preferencias, suscripción, soporte, auditoría); servicios, perfil y horario siguen siendo de psicólogas (también en la BD). E2E real |
| Tema oscuro | — | el diseño v3 solo tiene tema claro (la pestaña «Apariencia» no está ni en la demo). Añadirlo es una decisión de diseño: pendiente (decisión 13) |

### SaaS
| Funcionalidad | Estado | Nota |
|---|---|---|
| Registro, inicio de sesión, cierre, renovación automática, sesión caducada o revocada | 1 | |
| Confirmación de correo y recuperación de contraseña | 5 | necesitan SMTP |
| MFA | 4 | |
| Alta de clínica con plan y 14 días de prueba; varias clínicas por cuenta; selector | 1 | |
| Límites de plan (profesionales, pacientes…) | 1 | **valores provisionales** |
| Cambio de plan (en prueba) y cancelación al final del periodo | 1 | |
| Cobro de la suscripción (pasarela) | 5 | webhook preparado y probado con eventos firmados sintéticos; sin proveedor ni precios |
| Fin de prueba sin pago | 4 | no ocurre nada automáticamente |
| Panel central de KOVO (`admin.html`): clínicas, suspender/reactivar con motivo, plan, soporte | 1 | separado de la app de clínicas; no se publica en la demo |
| Cuenta suspendida = solo lectura (+ soporte) | 1 | lo impone la BD |
| Soporte (tickets) | 1 | |
| Auditoría de la clínica (panel) y de la plataforma | 1 | solo nombres de campo |
| Condiciones, privacidad, contrato de encargo aceptados al alta | 4 | textos inexistentes. Bloqueante |

### Infraestructura
| Funcionalidad | Estado | Nota |
|---|---|---|
| Pila local sin Docker y pruebas | 1 | |
| Migración de una base con datos al esquema nuevo sin pérdidas | 1 | sobre datos sintéticos; **no comparado con el esquema real de producción** |
| Copia y restauración | 1 | física en frío, local. Simulacro `pg_dump/pg_restore` del CI: 2 (necesita Docker; no ejecutado en este Mac, sintaxis comprobada) |
| CI (`kovo-ci.yml`) | 2 | en GitHub falló al subir (`2d23bba`): «Invalid workflow file: Unrecognized named-value: 'runner'». Corregido en local (`e4ce857`), **sin subir**. El modo que usa el CI (`db/run.mjs --external --e2e`) se ha ejecutado en verde contra una pila local nueva; `supabase start` en Docker no se ha podido ejecutar aquí |
| Staging | 4 | no existe |
| Producción | 4 | esquema antiguo; nada aplicado |
| Monitorización de errores del navegador | 4 | |

### Demo
| Funcionalidad | Estado | Nota |
|---|---|---|
| Demo pública (GitHub Pages) | 2 | interfaz v3 en esta rama (44 capturas idénticas al prototipo v3); **no publicada**: requiere subir y desplegar |

## 2. Pruebas (11/11/2026)

| Suite | Tipo | Resultado |
|---|---|---|
| Unitarias | Node, sin red | 226 |
| Navegador con API **simulada** | Playwright | 32 |
| Smoke demo / visual demo | Playwright | 1 / 22 (44 capturas, escritorio y móvil) |
| pgTAP consolidado / clínico | PostgreSQL real local | 123 / 81 |
| HTTP (Auth, PostgREST, Storage, webhook) | servicios reales locales | 136 |
| Concurrencia / migración de datos / copia | real local | 10 (reservas simultáneas: 5 rondas) / 27 / 5 |
| E2E por recorridos y roles | navegador + pila real local | 9 |
| E2E notas (suite heredada, **esquema antiguo**) | navegador + PostgreSQL/PostgREST locales | verde (pgTAP 43/43/81, HTTP 51, concurrencia 18, navegador 1) |
| Modo CI «pila externa» (`--external --e2e`) | pila local nueva sin esquema | pgTAP 123/81, HTTP 136, concurrencia 10, E2E 9 |
| Builds | Vite | demo y conectado (con `admin.html`) |

Las pruebas simuladas comprueban la interfaz y el manejo de errores; **no** prueban seguridad. La
seguridad la prueban pgTAP, HTTP y E2E contra servicios reales.

## 3. Riesgos

- Baseline del esquema no comparado con producción: la primera aplicación real puede encontrar diferencias.
- Repositorio **público**: cualquier secreto que llegue a Git queda expuesto. Un token de GitHub se expuso en un chat: **revocarlo**.
- Datos de salud sin EIPD, sin contrato de encargo y sin MFA.
- Interfaz heredada de la demo en un único archivo grande (`app/src/legacy.js`): cada cambio necesita las pruebas visuales.
- Pruebas visuales solo en macOS.
- Reservas simultáneas: sin `20261112090500`, PostgreSQL podía devolver bloqueos mutuos (40P01) en vez de «se solapa». Corregido en la cadena local; **producción no lo tiene**.

## 4. Decisiones pendientes de aprobación

1. Límites de los planes, precios y duración de la prueba.
2. Qué pasa al acabar la prueba sin pago y regla «impagada → suspendida».
3. Plan de las clínicas que ya existen en producción.
4. Proveedor de correo/SMS y de pagos (y región de los datos).
5. Firma electrónica de notas clínicas.
6. MFA obligatorio para personal de KOVO y administradores.
7. Imponer el horario en la base de datos.
8. Criterios fiscales (`docs/fiscal`) y legales (`docs/legal`).
9. Subir los commits locales para que GitHub ejecute el CI corregido.
10. Aplicado por defecto, revisable: días cerrados por profesional (no hay cierre de toda la clínica); rol `agenda` de solo lectura con códigos; diagnósticos y pruebas con el régimen de las notas clínicas.
11. Permitir borrar gastos a la clínica (hoy la BD no lo permite).
12. Diagnósticos: ¿texto libre o codificados (CIE-10/DSM-5)? Hoy texto libre.
13. Tema oscuro: el diseño v3 es solo claro. ¿Se diseña una versión oscura?
14. Facturar sesiones: hoy siempre en borrador. ¿Se permite emitir directamente (modo «automático» de la demo) una vez validado el criterio fiscal?
15. Agenda con varias profesionales (elegir profesional en cada cita, vista por profesional): necesaria antes de dar de alta profesionales sin cuenta.

## 5. Bloqueantes para vender

1. Crear staging, comparar esquema con producción, ensayar la migración y aplicarla (aprobación).
2. SMTP: confirmación de correo, recuperación de contraseña, invitaciones y recordatorios.
3. Pasarela de pago y precios; webhook desplegado con su secreto.
4. Facturas rectificativas y validación fiscal (incluido Verifactu si aplica).
5. Textos legales, contrato de encargo, EIPD, procedimiento de brechas.
6. MFA (al menos personal de KOVO).
7. Copias de Storage en el entorno alojado y ensayo de restauración en staging.
8. CI ejecutado en verde en GitHub.
