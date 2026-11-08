# Integración Supabase de KOVO

## Estado
- Cliente REST y autenticación por correo/contraseña implementados.
- Sesión guardada en sessionStorage (se elimina al cerrar la sesión del navegador).
- Contexto de organización y rol recuperado desde memberships.
- Transformaciones explícitas para pacientes, citas, notas y facturas.
- El adaptador **no carga ni escribe el estado legacy todavía**. Se bloquea deliberadamente para evitar importar IDs ficticios, duplicar registros o perder relaciones.

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
