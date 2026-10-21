# Despliegue de prueba en Cloudflare Pages

Actualización: 2026-10-21. El propietario autorizó la configuración y publicación de prueba en modo autónomo. Las restricciones anteriores de preparación exclusivamente local quedan sustituidas por esa autorización. El dominio principal, DNS y operaciones comerciales reales siguen fuera de alcance.

## Configuración verificada

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
| Proyecto creado | farmacia-reyna-del-cisne-pruebas |
| URL verificada | https://farmacia-reyna-del-cisne-pruebas.pages.dev |
| Commit servido | 28cbed850d242d0a0f268613c5057a70577af186 |
| Despliegue Pages | 8c4a0c9e-710e-40f4-b50e-f1b5f850745e |
| Otras ramas | Previews automáticas desactivadas; despliegue automático solo desde la rama Pages elegida |

La publicación de prueba se ejecutó y se verificó. El build Linux terminó con 94 archivos, 13.847.992 bytes y una regla de cabeceras válida; la diferencia de 4.380 bytes frente al artefacto Windows corresponde a finales de línea normalizados al hacer checkout de Git. Se comprobaron los módulos servidos contra las fuentes normalizando esos finales, sin diferencias funcionales. No se instalaron dependencias ni se usaron Functions/Workers.

El build estático no necesita secretos ni instala paquetes, carga .env, genera Prisma, conecta una base, ejecuta migraciones o siembra datos. No se usa setup:production para Pages. Cloudflare documenta el [build estático y su salida](https://developers.cloudflare.com/pages/configuration/build-configuration/) y la variable para [omitir la instalación automática](https://developers.cloudflare.com/pages/configuration/build-image/#skip-dependency-install).

## Seguridad y contenido

El artefacto contiene nueve HTML públicos, módulos JavaScript y MJS, recursos locales, config.js público, _headers y 404.html. Excluye servidor, Prisma, dependencias, .env, uploads, certificados, backups y datos de usuarios. El shell administrativo no contiene registros privados ni concede permisos. RIDE/XML siguen siendo respuestas privadas y autenticadas de Express.

CSP permite scripts, estilos y fuentes propios, imágenes de los dos orígenes públicos exactos y el iframe Google existente. No se utilizan comodines, unsafe-inline, unsafe-eval, proxies, Workers ni Pages Functions. Las rutas HTML y limpias conservan navegación; 404.html evita el fallback SPA general. HTML y recursos sin versionar revalidan con max-age=0; API y documentos privados mantienen no-store. No se exporta el service worker de la tienda histórica.

JWT continúa en sessionStorage, con Authorization Bearer y credentials:omit. No se introducen cookies ni cambios SameSite. El origen nuevo empieza con sesión y carrito propios; no se trasladan tokens por URL.

## Render existente

Servicio srv-db5sg2ss728c738t3n6g, Free, Virginia, rama configurada main y URL anterior conservados. CORS_ORIGIN se guardó con los dos orígenes exactos: https://farmacia-reina-del-cisne.onrender.com y https://farmacia-reyna-del-cisne-pruebas.pages.dev. No se permiten previews arbitrarias ni *.pages.dev. La API permanece en /api y sigue verificando roles, propietario, precios, stock e idempotencia.

La lectura del panel confirmó IMAGE_STORAGE=supabase, SKIP_INITIAL_SEED=true y el origen público de imágenes de la tabla. No se copiaron secretos. Antes del parche, un HEAD a una referencia UUID sintáctica confirmó la redirección a /storage/v1/object/public/farmaciaproductos/ con CORP same-origin. Después del parche, un upload público real devolvió CORP cross-origin y su destino Supabase respondió 200 image/webp, sin autenticación. La política de las API y documentos privados sigue siendo same-origin.

Se publicó el commit mínimo 75aee3e67ca0e807e8047f5e53e9e9769275cac2 de codex/pages-public-images: una línea de middleware y tres pruebas. Pasó 144/144 pruebas sobre SQLite temporal y Render lo dejó Live en el despliegue dep-dbceq0uktt5c73f6satg. La opción de desplegar un commit específico desactivó Auto-Deploy; se confirmó Off y se conserva así durante la prueba para no reemplazar el backend validado por otro commit de main. Main no se modificó. Antes de una promoción futura deberá integrarse este parche en la rama de backend elegida y decidir el control automático correspondiente.

No hay cambios de esquema, migraciones, dependencias o credenciales en ese commit. El pipeline existente ejecutó migrate deploy y omitió seed, como se verificó en los logs. Node 22.23.4 procede del NODE_VERSION=22 que ya tenía Render; no se cambió esa variable. La base y las imágenes continúan en los servicios existentes.

## Verificación y reversión

La integración conserva las funciones remotas ausentes del snapshot: asistente administrativo, ayuda contextual/responsive, eventos de carrito, estadísticas y tienda histórica. Todas las escrituras de las suites utilizan bases y uploads temporales. Los ensayos de suspensión y desconexión se hacen interceptando las peticiones del navegador de prueba, sin detener Render ni aplicar carga pública.

Validación local final: 177 Node, 38 históricas, 54 navegador de un origen y 20 entre orígenes, sin fallos ni omisiones. Las capturas históricas regeneradas se restauraron. En la URL publicada pasaron 18 GET estáticos, 10 comprobaciones API de solo lectura, dos HEAD de una imagen pública real y cinco escenarios de navegador: escritorio, móvil, API abortada, API retenida 30 s y sesión inválida/barrera administrativa. Catálogo, carrito local, requisito de login, CSP y comprobaciones automáticas de accesibilidad funcionaron. No se enviaron POST/PUT/DELETE a la API de la farmacia ni se crearon cuentas, pedidos, facturas o cambios de stock en la base remota.

Las sesiones válidas de cliente/admin, registro, ownership, compras, inventario y facturación se verificaron con fixtures temporales en las suites locales; no se presentan como operaciones privadas verificadas con cuentas reales en producción. No hay pasarela de pagos y no se emitió al SRI. La retención/desconexión pública se limita al navegador de prueba: no se suspendió Render. Evidencias y límites: [despliegue-cloudflare-2026-10-21.json](pruebas/despliegue-cloudflare-2026-10-21.json).

La comparación pública terminó con seis navegaciones secuenciales, tres pares, caché vacía y red real más limitación a 10 Mbps/40 ms: LCP mediano Render 9.368 ms frente a Pages 5.828 ms; FCP 1.856 ms en ambos. El proxy del navegador varió, la API estaba activa y no se controló la caché CDN: no se atribuye toda la mejora al hosting ni se presenta como percentil de usuarios o arranque en frío. En una comprobación funcional distinta, retener solo la API 30 s permitió mostrar shell y menú a los 1.330 ms. Método, muestras y límites en [RENDIMIENTO.md](RENDIMIENTO.md#comparación-de-las-urls-publicadas).

Estado: URL de prueba publicada y verificada, con coste mensual adicional de USD 0 en los planes gratuitos existentes. La promoción de dominio/DNS y la activación comercial requieren aprobación posterior; no se ejecutaron. Render Free conserva su suspensión por inactividad: los datos dinámicos aún pueden tardar mientras despierta. No se añadieron pings para impedirlo.

El enlace Render anterior permanece operativo, comprobado con HTTP 200. Para revertir la prueba, Pages conserva su despliegue de código 28cbed8 y Render el commit anterior 1e5580596e89d0bac591a773210e99b220fd0dd0. Una reversión controlada seleccionaría el commit del servicio y restauraría CORS al origen Render y Auto-Deploy al estado anterior On Commit, después de comprobar qué frontend debe seguir autorizado. No requiere restaurar una base, cambiar credenciales ni borrar servicios. El estado previo completo está guardado en la evidencia de despliegue. El dominio principal y DNS siguen intactos.

Las limitaciones gratuitas se documentan según [Pages](https://developers.cloudflare.com/pages/platform/limits/) y [Render](https://render.com/docs/free#spinning-down-on-idle): separar HTML no evita que la API suspendida tarde en responder. No se contratan servicios ni se activan planes de pago.
