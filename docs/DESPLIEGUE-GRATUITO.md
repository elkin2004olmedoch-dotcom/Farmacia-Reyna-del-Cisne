# Despliegue de la farmacia

El frontend activo es [Cloudflare Pages](https://farmacia-reyna-del-cisne-pruebas.pages.dev/) y la API existente está en [Render](https://farmacia-reina-del-cisne.onrender.com/api/salud). La base y las imágenes se gestionan desde Supabase mediante el backend. No hay conexión SQL ni clave privada de Supabase en el navegador.

## Cloudflare

Proyecto farmacia-reyna-del-cisne-pruebas; rama de producción codex/separacion-cloudflare. Build: node scripts/build-pages.cjs. Directorio: dist/pages. El empaquetador publica solo su lista permitida de frontend/ previamente generado con npm run build:frontend. Al cambiar plantillas, genera y versiona las vistas antes de publicar. No publiques la raíz del repositorio. [Separación de capas](SEPARACION_FRONTEND_BACKEND.md).

## Render

Servicio farmacia-reina-del-cisne, rama main, plan Free y Auto-Deploy Off. Build existente: npm ci --include=dev && npm run setup:production. Inicio: npm start. Salud: /api/salud. Las variables privadas se configuran en el servicio, nunca en Git. Conservar SKIP_INITIAL_SEED=true para la base existente.

setup:production genera el cliente PostgreSQL y aplica migraciones pendientes; no lo ejecutes contra una base ajena ni cambies datos sin respaldo y revisión. render.yaml refleja el servicio existente, pero modificar el archivo no equivale a autorizar otro servicio o reaplicar el blueprint. CORS permite exclusivamente los orígenes reales configurados.

## Límites

El plan gratuito puede suspenderse por inactividad y tiene cuotas; no ofrece disponibilidad continua. No se configuran monitores que mantengan despierto el servicio ni cambios de plan. PayPhone y SRI requieren activación comercial/configuración privada independiente. Los certificados y las credenciales se guardan fuera del repositorio.

Los workflows GitHub de verificación son manuales; no despliegan la raíz ni lanzan compilaciones nativas por cada push. Los respaldos de PostgreSQL y Storage deben conservarse en un destino privado del propietario.

## Si la tienda abre pero no carga datos

Comprueba `/api/salud` y una consulta de catálogo tanto en Pages como en Render. Un `429` con `Content-Type: text/html` y `cf-mitigated: challenge` procede de la protección perimetral, antes de Express; no demuestra que se hayan borrado productos. El proxy devuelve un error JSON legible, conserva el estado de error y no ejecuta ni reenvía el HTML de esa verificación. Los límites JSON de la aplicación conservan su mensaje y `Retry-After`. No se repiten automáticamente compras ni otros cambios.

Revisa Events/Logs del servicio y guarda la hora, el estado HTTP y el `CF-Ray` para el soporte del proveedor. Si el bloqueo continúa con el servicio Live, debe revisarlo Render; no se resuelve cambiando contraseñas, sembrando otra vez la base o desactivando los controles de seguridad. Los límites de tráfico son inferiores en instancias gratuitas. [Diagnóstico de errores 429](https://render.com/docs/troubleshooting-deploys#429-too-many-requests), [protección DDoS de Render](https://render.com/docs/ddos-protection).
