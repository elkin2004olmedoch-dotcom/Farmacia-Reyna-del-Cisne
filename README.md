# Farmacia Reina del Cisne

Tienda y gestión farmacéutica para Puerto Quito, con catálogo, carrito, pedidos, administración y reparto. Conserva la identidad crema/vino, el logo y las mascotas.

## Abrir la aplicación

- [Tienda y botón Obtener app](https://farmacia-reyna-del-cisne-pruebas.pages.dev/).
- [Administración instalable en Windows](https://farmacia-reyna-del-cisne-pruebas.pages.dev/instalar-admin): Edge/Chrome normal y cuenta de administrador.
- [Entregas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/entregas): requiere cuenta de administrador o repartidor.
- [Pagos de demostración](https://farmacia-reyna-del-cisne-pruebas.pages.dev/pagos): sin cobros reales.
- [Reparto Android de pruebas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/descargas/reparto-0.1.0.apk).

Los accesos privados se entregan fuera del repositorio. [Instalación de las apps](docs/APPS-E-INSTALACION.md).

## Arquitectura

Tres capas: presentación HTML/CSS/JavaScript, aplicación Node.js/Express y persistencia Prisma 6/PostgreSQL en Supabase. SQLite se utiliza para desarrollo y pruebas.

| Ruta | Uso |
| --- | --- |
| frontend/ | Aplicación MVC publicada, instalación, catálogo y administración |
| server/ | API REST, autenticación JWT, roles y reglas de negocio |
| server/prisma/ | Esquema y migraciones SQLite |
| server/prisma/postgresql/ | Esquema y migraciones PostgreSQL |
| mobile/ | Aplicación nativa independiente de reparto Android/iPhone |
| scripts/ | Generación de vistas, distribución y comprobaciones |
| tests/ | Pruebas con datos sintéticos y bases temporales |
| assets/, js/ y HTML de raíz | Antecedente académico conservado para test:reto1 |

El HTML de frontend/ se genera desde scripts/build-frontend.cjs y scripts/templates/. Cloudflare publica únicamente la salida de scripts/build-pages.cjs; Render mantiene la API existente. [Arquitectura comercial](docs/ARQUITECTURA-COMERCIAL.md).

## Desarrollo y pruebas

Requiere Node.js 22.13 o posterior compatible y las versiones fijadas en package-lock.json. Configura las variables de .env.example en un .env privado. Para una instalación SQLite NUEVA, npm run setup aplica migraciones y datos iniciales; no se debe ejecutar con credenciales de producción ni para reemplazar una base existente.

Comandos habituales: npm start, npm run build:frontend, npm run build:pages, npm test, npm run test:reto1 y npm run test:browser. Las pruebas de PostgreSQL requieren un servidor temporal separado. No se prueba con pedidos o pagos comerciales.

Los workflows de verificación se ejecutan manualmente desde Actions. No hay compilaciones automáticas de macOS/iOS, tareas programadas de notificaciones ni despliegues de GitHub Pages. Render permanece Free y con Auto-Deploy Off. [Despliegue](docs/DESPLIEGUE-GRATUITO.md).

## Seguridad y proveedores

No se incluyen claves, contraseñas de acceso, certificados, respaldos ni capturas con sesiones. .env, .publish/ y las salidas de pruebas están excluidos de Git. La administración exige autorización en la API; instalar una app no concede permisos.

Farmi procesa órdenes locales del panel, sin API de IA. El seguimiento abre Maps mediante enlaces o un mapa voluntario. PayPhone permanece desactivado hasta configurar una cuenta comercial; SRI exige configuración y certificado privados. No se contrataron servicios ni se activaron cobros. [Pagos](docs/PAGOS-Y-PAYPHONE.md), [entregas](docs/ENTREGAS-Y-PRIVACIDAD.md) y [seguridad de publicación](docs/SEGURIDAD_DESPLIEGUE.md).

La app nativa de reparto para iPhone requiere firma de Apple y pruebas físicas. Render Free puede suspenderse por inactividad; no acredita disponibilidad 24/7. El Reto 3 sigue pendiente del framework asignado.

## Evidencias

[Pruebas y publicación actuales](docs/APPS-INSTALABLES-2026-11-01.md). El material auxiliar y los informes históricos retirados tienen respaldo local privado del propietario; las mascotas activas y el código de negocio se conservan.
