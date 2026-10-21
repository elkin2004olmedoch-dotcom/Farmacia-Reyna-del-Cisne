# Despliegue de prueba en Cloudflare Pages

Actualización: 2026-10-21. El propietario autorizó la configuración y publicación de prueba en modo autónomo. Las restricciones anteriores de preparación exclusivamente local quedan sustituidas por esa autorización. El dominio principal, DNS y operaciones comerciales reales siguen fuera de alcance.

## Configuración preparada

| Ajuste | Valor |
| --- | --- |
| Repositorio | elkin2004olmedoch-dotcom/Farmacia-Reyna-del-Cisne |
| Rama Pages | codex/separacion-cloudflare, integrada sobre el historial real; no sustituirlo por el snapshot 07706e6 |
| Preset | None |
| Raíz | Raíz del repositorio, campo Path vacío |
| Build | node scripts/build-pages.cjs |
| Salida | dist/pages |
| PUBLIC_API_ORIGIN | https://farmacia-reina-del-cisne.onrender.com |
| PUBLIC_IMAGE_ORIGIN | https://xjxnnqasikxlytjaxjdt.supabase.co |
| SKIP_DEPENDENCY_INSTALL | true; el generador solo utiliza módulos de Node |
| NODE_VERSION | 24.15.0, versión utilizada en las pruebas locales |
| Nombre propuesto en formulario | farmacia-reyna-del-cisne-pruebas; aún no acredita un despliegue |

La sesión Cloudflare y la instalación GitHub ya están disponibles. El formulario no se publica hasta comprobar la rama y el artefacto. La URL definitiva y el resultado del build se registrarán tras verificarlos; no se presenta el nombre previsto como una URL existente.

El build estático no necesita secretos ni instala paquetes, carga .env, genera Prisma, conecta una base, ejecuta migraciones o siembra datos. No se usa setup:production para Pages. Cloudflare documenta el [build estático y su salida](https://developers.cloudflare.com/pages/configuration/build-configuration/) y la variable para [omitir la instalación automática](https://developers.cloudflare.com/pages/configuration/build-image/#skip-dependency-install).

## Seguridad y contenido

El artefacto contiene nueve HTML públicos, módulos JavaScript y MJS, recursos locales, config.js público, _headers y 404.html. Excluye servidor, Prisma, dependencias, .env, uploads, certificados, backups y datos de usuarios. El shell administrativo no contiene registros privados ni concede permisos. RIDE/XML siguen siendo respuestas privadas y autenticadas de Express.

CSP permite scripts, estilos y fuentes propios, imágenes de los dos orígenes públicos exactos y el iframe Google existente. No se utilizan comodines, unsafe-inline, unsafe-eval, proxies, Workers ni Pages Functions. Las rutas HTML y limpias conservan navegación; 404.html evita el fallback SPA general. HTML y recursos sin versionar revalidan con max-age=0; API y documentos privados mantienen no-store. No se exporta el service worker de la tienda histórica.

JWT continúa en sessionStorage, con Authorization Bearer y credentials:omit. No se introducen cookies ni cambios SameSite. El origen nuevo empieza con sesión y carrito propios; no se trasladan tokens por URL.

## Render existente

Servicio srv-db5sg2ss728c738t3n6g, Free, Virginia, rama main y URL anterior conservados. La variable CORS_ORIGIN deberá conservar Render y añadir únicamente el origen Pages realmente creado. No se permiten previews arbitrarias ni *.pages.dev. La API permanece en /api y sigue verificando roles, propietario, precios, stock e idempotencia.

La lectura del panel confirmó IMAGE_STORAGE=supabase, SKIP_INITIAL_SEED=true y el origen público de imágenes de la tabla. No se copiaron secretos. Un HEAD no destructivo a una referencia UUID sintáctica confirmó que el backend actual redirige a /storage/v1/object/public/farmaciaproductos/ y devuelve CORP same-origin: necesita el parche acotado a /assets/uploads antes de servir imágenes a Pages. La comprobación no requiere que exista el objeto y no enumera datos privados.

Se preparó el commit mínimo 75aee3e67ca0e807e8047f5e53e9e9769275cac2 en codex/pages-public-images: una línea de middleware y tres pruebas. El backend pasó 144/144 pruebas sobre fixtures SQLite temporales; todavía debe verificarse el despliegue remoto. No hay cambios de esquema, migraciones, dependencias o datos en ese commit. setup:production siempre ejecuta migrate deploy; omitir seed no equivale a omitir migraciones. Por ello cualquier build remoto se limita al código/esquemas existentes y se revisan sus logs, sin usarlo como experimento.

## Verificación y reversión

La integración conserva las funciones remotas ausentes del snapshot: asistente administrativo, ayuda contextual/responsive, eventos de carrito, estadísticas y tienda histórica. Todas las escrituras de las suites utilizan bases y uploads temporales. Los ensayos de suspensión y desconexión se hacen interceptando las peticiones del navegador de prueba, sin detener Render ni aplicar carga pública.

Antes de anunciar la URL se comprobarán build, cabeceras, CSP/CORS, módulos MJS, imágenes, catálogo, rutas, móvil, autorización y shell con API bloqueada. Los resultados reales se distinguirán de las simulaciones y de la cobertura local. No hay pasarela de pagos: no se simulan cobros como si existieran.

El enlace Render anterior permanece operativo. Una reversión de Pages utilizará su despliegue anterior o desactivará el nuevo acceso sin tocar DNS, bases ni secretos. La reversión del backend consiste en volver al commit de servicio previamente registrado y restaurar únicamente los ajustes modificados. Se conserva la configuración anterior de CORS y de despliegue antes de guardarla. No se borran servicios ni datos.

Las limitaciones gratuitas se documentan según [Pages](https://developers.cloudflare.com/pages/platform/limits/) y [Render](https://render.com/docs/free#spinning-down-on-idle): separar HTML no evita que la API suspendida tarde en responder. No se contratan servicios ni se activan planes de pago.
