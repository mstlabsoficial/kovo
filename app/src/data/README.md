# Integración Supabase de KOVO

## Estado
- Cliente REST y autenticación por correo/contraseña implementados.
- Sesión guardada en sessionStorage (se elimina al cerrar la sesión del navegador).
- Contexto de organización y rol recuperado desde memberships.
- Transformaciones explícitas para pacientes, citas, notas y facturas.
- `load()` en modo Supabase: lectura por rol de todas las tablas de negocio, conversión al modelo legacy (`from-supabase.js`, `legacy-state.js`). Correspondencias, valores de presentación e incompatibilidades en `from-supabase.md`.
- Escritura de **pacientes y citas** (altas, cambios y estados), una operación por acción y confirmada por Supabase: `writes.js`, `legacy-writes.js`. Detalle, garantías y bloqueos de lo pendiente en `escrituras.md`.
- El resto de cambios no se guarda: `persist()` no sincroniza el estado completo. El modo sigue desactivado por defecto.

## Configuración DEV
Copia `.env.example` a `.env.local`, completa la publishable key del proyecto DEV y establece `VITE_DATA_MODE=supabase` solo para probar autenticación. No uses service_role en el navegador.

## Pendiente antes de habilitar persistencia
1. Importador transaccional con mapa de IDs legacy → UUID y rollback.
2. Catálogos y claves foráneas: profesionales, servicios y pacientes.
3. Notas clínicas: crear borradores y firmar exclusivamente mediante RPC.
4. Facturas: emitir exclusivamente mediante RPC; líneas y pagos ligados a UUID.
5. Documentos: Storage privado, rutas por organización/paciente y permisos.
6. Tests de RLS con usuarios reales de cada rol y dos organizaciones.
7. Pruebas de restauración y auditoría.

No cargar datos reales hasta superar estas pruebas y completar la revisión de protección de datos.
