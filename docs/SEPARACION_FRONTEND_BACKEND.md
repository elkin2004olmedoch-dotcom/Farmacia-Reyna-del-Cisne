# Separación de frontend y backend

La aplicación pública utiliza Cloudflare Pages para frontend/ y el servicio Express existente en Render para /api. El HTML histórico de raíz pertenece al antecedente académico; no es la fuente del build MVC.

## Contrato de integración

scripts/build-pages.cjs empaqueta las vistas y un proxy /api/* con destino fijo en Render. frontend/config.js y frontend/models/api.js centralizan las solicitudes del mismo origen, cookies HttpOnly, renovación, lectura de errores y límites de espera. El navegador no recibe conexión SQL ni claves privadas de Supabase.

La API autoriza por usuario y rol y recalcula reglas de negocio. Prisma 6 conserva proveedores SQLite local y PostgreSQL remoto, con migraciones separadas y un cliente reutilizado. Ninguna instalación de la tienda o administración concede permisos nuevos.

CORS permite orígenes exactos de Cloudflare y Render, sin comodines. La web usa cookies HttpOnly del mismo origen y valida Origin y el encabezado X-Farmacia-Web para cambios autenticados. Las rutas privadas y documentos requieren sesión y validación de propiedad. El service worker guarda solo la pantalla pública offline; no replica la base ni conserva HTML de sesión.

## Publicación

Cloudflare publica exclusivamente dist/pages mediante el empaquetador; no se sube la raíz, server/ ni archivos de entorno. Render mantiene el servicio existente, plan Free y Auto-Deploy Off. Las variables se cargan desde el proveedor. No se reaplican blueprints ni se cambian tablas por modificar documentación.

[Configuración de hosting](DESPLIEGUE-GRATUITO.md), [pruebas](APPS-INSTALABLES-2026-11-01.md), [contrato de entregas](CONTRATO-ENTREGAS.md) y [seguridad](SEGURIDAD_DESPLIEGUE.md).

[Sesiones, CSRF y recuperación de contraseña](SESIONES-Y-RECUPERACION.md).
