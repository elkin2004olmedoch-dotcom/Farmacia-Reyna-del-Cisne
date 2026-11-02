# Separación de frontend y backend

La aplicación pública utiliza Cloudflare Pages para frontend/ y el servicio Express existente en Render para /api. El HTML histórico de raíz pertenece al antecedente académico; no es la fuente del build MVC.

## Contrato de integración

scripts/build-pages.cjs genera las vistas y fija la URL de API en la configuración de distribución. frontend/config.js y frontend/models/api.js centralizan las solicitudes: URL base, Authorization Bearer, lectura de errores y límites de espera. El navegador no recibe conexión SQL ni claves privadas de Supabase.

La API autoriza por usuario y rol y recalcula reglas de negocio. Prisma 6 conserva proveedores SQLite local y PostgreSQL remoto, con migraciones separadas y un cliente reutilizado. Ninguna instalación de la tienda o administración concede permisos nuevos.

CORS permite orígenes exactos de Cloudflare y Render, sin comodines ni cookies de autenticación. Las rutas privadas y documentos requieren sesión y validación de propiedad. El worker guarda solo la pantalla pública offline; no replica la base ni conserva HTML de sesión.

## Publicación

Cloudflare publica exclusivamente dist/pages mediante el empaquetador; no se sube la raíz, server/ ni archivos de entorno. Render mantiene el servicio existente, plan Free y Auto-Deploy Off. Las variables se cargan desde el proveedor. No se reaplican blueprints ni se cambian tablas por modificar documentación.

[Configuración de hosting](DESPLIEGUE-GRATUITO.md), [pruebas](APPS-INSTALABLES-2026-11-01.md), [contrato de entregas](CONTRATO-ENTREGAS.md) y [seguridad](SEGURIDAD_DESPLIEGUE.md).
