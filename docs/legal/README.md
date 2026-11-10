# KOVO · protección de datos (RGPD / LOPDGDD): notas de trabajo

Estado a 10/11/2026. **Esto no es asesoramiento jurídico ni una declaración de cumplimiento.** Recoge
cómo está construido KOVO y qué tiene que revisar y decidir una asesoría especializada en protección de
datos sanitarios antes de vender el servicio. Ninguna frase de este documento debe usarse en la web o en
contratos como «KOVO cumple el RGPD».

## 1. Papeles

| Quién | Papel probable | Consecuencia |
|---|---|---|
| Cada clínica / profesional | Responsable del tratamiento de los datos de sus pacientes | Decide fines; informa a los pacientes; atiende sus derechos |
| KOVO (titular del servicio) | Encargado del tratamiento (art. 28 RGPD) para los datos de pacientes; responsable de los datos de sus propios clientes (cuentas, facturación de la suscripción) | Necesita un **contrato de encargo** con cada clínica (aceptado al darse de alta) — **no redactado** |
| Supabase y su proveedor de nube, proveedor de correo, pasarela de pago | Subencargados | Lista pública de subencargados, región de los datos, contratos (DPA) y, si hay transferencias fuera del EEE, garantías — **pendiente de revisar** |

El texto del contrato de encargo, la política de privacidad de KOVO y las condiciones del servicio **no
existen todavía**. El alta en la app no muestra ni registra la aceptación de ninguno (bloqueante).

## 2. Categoría de datos

Las notas clínicas, documentos y citas con un psicólogo son **datos de salud** (art. 9 RGPD): categoría
especial. Implica, entre otras cosas, valorar una **evaluación de impacto (EIPD, art. 35 RGPD; art. 28.2
LOPDGDD)**. A escala de una plataforma que trata datos de salud de muchas clínicas, lo prudente es asumir
que KOVO la necesita. **No se ha hecho.**

## 3. Medidas técnicas implementadas (comprobadas en las pruebas de esta rama)

- Aislamiento por clínica en la base de datos (RLS) con pruebas de acceso cruzado por REST, RPC y Storage.
- Permisos por rol: recepción y gestoría no ven notas clínicas ni documentos; gestoría no ve agenda ni fichas.
- Documentos en un bucket privado; descarga solo con sesión válida y permiso; rutas validadas.
- Notas clínicas: borradores con versiones; firma e inmutabilidad en la base de datos (la interfaz de firma está desactivada hasta validarla).
- Auditoría de cambios con **solo nombres de campo**, nunca valores; auditoría separada de las acciones del personal de KOVO, con motivo obligatorio.
- Sesiones revocables (cierre de sesión global invalida tokens en uso), rotación de refresh tokens.
- El personal de KOVO **no puede leer** pacientes, notas, citas, documentos ni facturas de las clínicas: solo recuentos y datos de cuenta (probado).
- Sin datos de pacientes en logs ni en servicios de IA. La demo usa datos ficticios.
- Clave de servicio solo en el servidor.

**No implementado:** MFA (recomendable al menos para personal de KOVO y administradores de clínica),
cifrado a nivel de campo de las notas, registro de accesos de lectura (hoy se auditan cambios, no
lecturas), exportación de datos de un paciente en formato estructurado, procedimiento de borrado al
terminar el contrato.

## 4. Conservación

La Ley 41/2002 (autonomía del paciente), art. 17, obliga a conservar la documentación clínica como
mínimo cinco años desde el alta de cada proceso asistencial; varias comunidades autónomas fijan plazos
más largos. Hay que confirmar con la asesoría:

- qué plazo aplica a cada clínica (depende de su comunidad) y si la psicología sanitaria privada entra en
  el mismo régimen;
- qué hace KOVO cuando una clínica se da de baja (devolver los datos, conservarlos bloqueados en nombre
  de la clínica o borrarlos), y durante cuánto tiempo;
- plazos de conservación de facturas (normativa fiscal y mercantil).

Hoy: KOVO **no borra nada automáticamente**. Retirar un documento es una baja lógica (se conserva).
Cerrar una cuenta conserva todos los datos.

## 5. Derechos de los pacientes

Los atiende la clínica (responsable); KOVO debe ayudar (art. 28.3.e). Hoy no hay herramientas en la app
para: exportar todos los datos de un paciente, limitar su tratamiento ni anonimizarlo. La supresión
choca con la obligación de conservación de la historia clínica: cada caso debe valorarlo la clínica.
Procedimiento manual: la clínica abre un ticket de soporte **sin datos del paciente** y se coordina por
un canal seguro (pendiente de definir).

## 6. Brechas de seguridad

- La clínica (responsable) notifica a la AEPD en 72 h cuando proceda (art. 33) y, si hay alto riesgo, a los pacientes (art. 34).
- KOVO (encargado) debe avisar a la clínica **sin dilación indebida** (art. 33.2).
- Pendiente: procedimiento escrito, contactos, registro de incidentes, plantillas de aviso.

## 7. Otros puntos a revisar

- Registro de actividades de tratamiento de KOVO (art. 30).
- Delegado de protección de datos: valorar si KOVO está obligado (art. 37 RGPD, art. 34 LOPDGDD).
- Consentimiento informado clínico: la app permite subir el documento firmado; el modelo de texto lo aporta la clínica.
- Comunicaciones a pacientes (recordatorios): base jurídica y contenido mínimo (sin datos clínicos en el mensaje).
- Esquema Nacional de Seguridad: solo si se vende a administraciones públicas.
