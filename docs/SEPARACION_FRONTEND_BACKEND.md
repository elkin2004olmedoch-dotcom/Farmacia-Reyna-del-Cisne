# Separación local del frontend y backend

## Continuación autónoma autorizada: despliegue de prueba

El 2026-10-21 el propietario autorizó configurar y publicar una URL de prueba Pages con integración Git y ajustar el servicio Render existente. Esa autorización sustituye las restricciones de publicación de la fase local descrita más abajo. No incluye cambios de dominio/DNS, contratación, pagos reales, pedidos comerciales, eliminación de datos ni módulos nuevos.

- [x] Perfilar la regresión con caché vacía, red limitada, candidato LCP, waterfall y trazas. Aislar una causa por experimento antes de corregir; comparar con las mismas condiciones y conservar la evidencia desfavorable previa.
- [x] Integrar los cambios sobre el historial real de GitHub, en `codex/separacion-cloudflare`, conservando las funciones remotas de ayuda contextual y administración. No reemplazar el repositorio por el snapshot ni actualizar main.
- [x] Generar únicamente el artefacto estático con `scripts/build-pages.cjs`, origen API existente y origen público exacto de imágenes; revisar CSP, rutas, 404 y ausencia de archivos privados.
- [x] Crear Pages Git con raíz del repositorio, comando `node scripts/build-pages.cjs` y salida `dist/pages`. Conservar planes gratuitos, sin Workers ni cambios DNS. Solicitar al propietario solo autenticación/verificaciones indispensables.
- [x] Configurar CORS con los orígenes exactos Render y Pages, sin alterar credenciales. Verificar primero si el backend desplegado necesita cambios de código; evitar builds/migraciones innecesarios.
- [x] Ejecutar suites Node, históricas y todas las specs de navegador en bases temporales, con directorios de resultados separados. Las escrituras comerciales y pruebas de ownership usan fixtures locales; las comprobaciones públicas no modifican datos existentes.
- [x] Verificar la URL desplegada, recursos, API, restricciones, navegación móvil y disponibilidad del shell con API bloqueada en el navegador de prueba. Documentar métricas reales separadas de simulaciones, resultados, costes y reversión. Mantener Render y el dominio actual operativos.

Riesgos que deben verificarse: recursos Supabase bloqueados por CSP/CORP, imports o fuentes que retrasen la pintura, pérdida de funciones al combinar copias divergentes, mezcla de specs con servidores distintos y escrituras involuntarias en PostgreSQL de producción.

Estado al cierre: [Pages de prueba publicado y verificado](https://farmacia-reyna-del-cisne-pruebas.pages.dev/), frontend `28cbed8` y backend mínimo `75aee3e` Live. Configuración exacta, pruebas, coste adicional USD 0 y reversión: [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md). Métricas públicas y límites: [RENDIMIENTO.md](RENDIMIENTO.md#comparación-de-las-urls-publicadas). Main, dominio principal y DNS permanecen intactos. Render Auto-Deploy está Off después de seleccionar el commit; antes de una promoción futura debe integrarse el parche de backend en la rama elegida y revisar ese control.

Las secciones siguientes conservan el registro histórico de la preparación local del 2026-10-21, antes de la autorización y el despliegue. Sus cifras y acciones pendientes corresponden a esa fase; el estado vigente es el cierre anterior y la evidencia enlazada.

## Análisis y diseño

Antes: Express en Render sirve los nueve HTML, recursos y API. Una instancia no disponible retrasa incluso el documento inicial. Propuesta autorizada: Cloudflare Pages sirve exclusivamente los estáticos; el navegador consulta directamente la API existente de Render mediante una configuración pública central. No se usa proxy, Worker, Functions, nuevo framework ni catálogo ficticio.

Los nueve HTML son plantillas sin datos privados: inicio, catálogo, producto, comparación, cuenta, carrito, pedidos, administración y ayuda. El shell administrativo no otorga permisos. El RIDE generado por Express sí contiene datos personales y debe permanecer autenticado en la API, junto con XML, pedidos y configuración interna.

La autorización existente es JWT Bearer en sessionStorage, sin cookies de sesión. Se conserva ese mecanismo y CORS sin credenciales. CORS debe permitir explícitamente ambos orígenes aprobados; CSP del frontend se entrega desde Pages. Los datos guardados en el origen anterior, incluido carrito y token, no se trasladan automáticamente.

Se prefiere un artefacto estático con lista permitida frente a copiar el repositorio completo o introducir un proxy. La alternativa de exportar catálogo necesita actualización y etiquetado de datos informativos; queda como investigación y no se añade sincronización sin una necesidad medida.

## Plan de implementación

- [x] Centralizar apiOrigin, apiUrl y publicImageUrl en frontend/config.js. Por defecto conservar mismo origen; el empaquetador genera la configuración de Pages. Ajustar los dos Fetch de API y las imágenes subidas sin alterar los paths persistidos.
- [x] Añadir timeout de 10 s por intento de lectura y un único reintento tras 500 ms para GET de productos/promociones por error de red/502/503/504. Mantener 60 s para escrituras y descargas privadas; POST, PUT, DELETE, login y creación de pedidos nunca se reintentan automáticamente. Mantener cancelación, expiración y mensajes accesibles.
- [x] Inicializar las funciones visuales públicas sin esperar la identidad. Mantener compras ocultas mientras se verifica el rol y conservar autorización en Express.
- [x] Generar dist/pages desde archivos permitidos, excluyendo uploads, secretos y archivos internos. Añadir CSP, caché con revalidación y 404 real, sin fallback SPA ni API.
- [x] Conservar lista CORS exacta y reforzar validación; permitir CORP solo para imágenes públicas subidas. Validar preflight y APIs sensibles con pruebas.
- [x] Probar dos orígenes locales con API activa, demorada e inaccesible, identidad, carrito, admin, imágenes y stock. Medir documento/FCP/LCP/bytes separados de disponibilidad de datos; ninguna simulación equivale a medir Cloudflare real.
- [x] Repetir suites existentes pertinentes; registrar resultados, manual de despliegue y reversión. Revisar y sincronizar únicamente cambios de esta rama a la carpeta original.

## Criterios de aceptación

La portada, navegación, contacto y recursos locales deben renderizarse aunque la API no responda. Los datos dinámicos muestran carga o error accesible y se recuperan de forma acotada. No se inventan precios o existencias, ni se confirma un pedido sin Express. El artefacto no contiene secretos, datos privados ni código de servidor. Las restricciones de admin/propietario se conservan. No se despliega ni se cambia DNS, Render o su configuración remota.

## Rama de trabajo

La integración Git se prepara sobre el remoto real `1e55805`, incorporando los cambios acotados de `07706e6`. Conserva la tienda histórica de GitHub Pages y su service worker, el asistente administrativo, las estadísticas por categoría, la ayuda contextual/responsive de mascotas, el evento de carrito y la configuración de despliegue Render. El empaquetado y la captura del baseline deben conservar también módulos `.mjs`. Las evidencias previas de la copia local se distinguen de las comprobaciones de esta integración.

La carpeta original no tiene .git; github-work es otro checkout que no se modifica. Se creó una copia del código sin secretos ni dependencias en `C:/Users/Elkin/.codex/worktrees/farmacia-cloudflare-20261021`, rama local `codex/separacion-cloudflare`, sin remoto. Un manifiesto SHA-256 y un ZIP en TEMP conservan la línea base. node_modules se reutiliza mediante una junction local excluida de Git; no se instalaron dependencias.

## Resultados

### Dependencias revisadas

| Archivo/página | Estático y dependencia dinámica |
| --- | --- |
| `index.html` | Fachada, servicios, ubicación, contacto y navegación locales. Productos/campañas públicos y sesión opcional por API. |
| `ayuda.html` | Información pública estática; personalización opcional de sesión. |
| `catalogo.html`, `producto.html`, `comparar.html` | Shell estático. Catálogo, precios, ficha, stock y promociones proceden de Express/PostgreSQL. |
| `cuenta.html` | Formularios estáticos. Login/registro y perfil consultan la base en Express. |
| `checkout.html` | Shell/formulario y carrito local; catálogo, identidad y confirmación del pedido requieren Express. |
| `pedidos.html` | Shell; pedidos y facturas propios requieren identidad verificada y consultas autorizadas. |
| `admin.html` | Shell sin usuarios, pedidos, proveedores ni configuración privada incrustados; toda gestión requiere API con permisos. |
| CSS, fuentes, imágenes `assets/images`, mascota | Recursos locales de Pages; los imports y el manifest del widget conservan sus rutas relativas. |
| `assets/uploads/*` | Recursos públicos servidos por el origen Express y, en modo nube, redirigidos al almacenamiento. No se copian al artefacto. |
| RIDE/XML | Respuestas privadas de facturación; nunca se exportan ni cachean en el frontend estático. |

Se inspeccionaron rutas, modelos de cliente, vistas, controladores, CSS y generación HTML. No hay motor de plantillas Express generando datos privados en los nueve HTML. El RIDE sí se genera con comprador, dirección e importes en el modelo SRI y conserva autorización/propietario en `/api/{admin/}facturacion/facturas/:id/ride`.

Los dos consumidores directos de API son `models/api.js` y `models/billing.js`. Los demás modelos reutilizan `request`. Se ajustaron también tarjetas/detalle/promociones, preview administrativo y zoom para que los uploads usen Express; la referencia persistida continúa siendo `assets/uploads/...`. Navegación, imágenes incluidas, fuentes, CSS y manifest de mascota permanecen locales. Se reconoce la normalización de URLs `.html` del proveedor para el enlace activo.

### API, autenticación y seguridad

No se añaden ni duplican endpoints. Se conservan contratos, validación, transacciones, idempotencia y consultas Prisma:

| Grupo de API | Acceso y dependencia |
| --- | --- |
| GET salud/productos/promociones | Lectura pública; salud ejecuta una consulta mínima y catálogo/campañas consultan la base. No se invoca salud desde la portada. |
| Login/registro | Públicos con validación y limitador; consultan/escriben identidad en backend. |
| Sesión/perfil/logout | Bearer verificado y revocación existentes. |
| Pedidos propios/creación | Usuario autenticado, ownership y recálculo servidor de precios/stock; clave idempotente existente. |
| Productos/promociones/escrituras, dashboard/inventario/usuarios | JWT y rol administrador según las rutas existentes. |
| Facturación/configuración/certificado/emisión | Autorización existente; XML/RIDE comprueban propietario/administrador. No se usan servicios fiscales reales en las pruebas. |

El runtime conserva un cliente Prisma compartido. No se cambia ORM, conexión, pool, esquema, índices ni migraciones. La autorización nunca se deriva de ocultar el HTML. CORS es una restricción del navegador y no sustituye JWT, roles ni comprobación de propietario.

La autenticación no depende de cookies: no existe una cookie de sesión a la que aplicar HttpOnly, Secure o SameSite en esta fase. Los Fetch usan Bearer y `credentials:'omit'`; CORS mantiene `credentials:false`, lista exacta y preflight para Authorization/JSON. No se habilita autenticación cross-site por cookies ni se modifica el mecanismo de sesión. El CSRF clásico basado en cookies no se introduce; el riesgo previo de XSS sobre un token accesible a JavaScript sigue siendo una limitación existente.

La CSP debe servirse desde Pages para proteger sus documentos. Permite únicamente el origen de API y el origen público adicional de imágenes configurado. No permite scripts inline ni eval, ni carga de APIs desde parámetros de URL. CORP cambia solo en `/assets/uploads`, no en API ni RIDE. Los datos y descargas privadas siguen `no-store`, y las descargas mantienen Fetch autenticado → Blob → archivo sin token en el enlace.

### Comportamiento ante Render no disponible

La portada inicia layout/contacto y carga sus dos secciones dinámicas independientemente de la restauración de sesión. Mientras el rol está pendiente, las acciones de compra permanecen ocultas; un timeout/503 no borra el token ni concede permisos. La mascota sigue esperando la identidad para conservar su exclusión de administradores. Menú, fachada y contacto funcionan antes de esa respuesta.

Las lecturas normales tienen 10 s de límite, incluyendo la lectura del cuerpo. Las escrituras y descargas privadas permiten 60 s, sin reintento, para conservar margen para las operaciones existentes: por ejemplo SRI puede realizar dos llamadas de hasta 12 s más su transacción. No se modifica ese proceso fiscal ni se prueba emisión real. Solo GET de productos/promociones puede repetir una vez tras 500 ms ante error de conexión, timeout o HTTP 502/503/504. Otros errores HTTP, JSON inválido, autenticación, descargas y todas las escrituras no se reintentan automáticamente. Máximo por esa operación pública: dos intentos de 10 s más 500 ms de espera. No hay bucles de reintento dentro de una misma operación.

Los watchers funcionales ya existentes se registran antes de la primera lectura: al volver a la pestaña o en el refresco visible habitual pueden recuperar datos después de un fallo inicial. Conservan su control de una petición en curso y la pausa por documento oculto. No se añadieron pings de salud ni tráfico cuyo único propósito sea impedir la suspensión. Cada nuevo refresco sigue siendo una operación separada con el límite anterior.

Esa recuperación corresponde a productos/campañas. Si la restauración de identidad termina por timeout o fallo de red, las compras siguen ocultas hasta verificarla al recargar o entrar de nuevo en Cuenta; no se realiza un bucle de autenticación en segundo plano. La información pública permanece utilizable durante esa espera.

Los estados de carga/error son visibles y accesibles (`aria-live`, status/alert). Si nunca llega catálogo no se muestran productos/precios inventados. El carrito conserva sus cantidades locales; el pedido solo se confirma tras respuesta válida del servidor. Un timeout de escritura puede tener resultado incierto si el servidor alcanzó a procesarla: no se reenvía automáticamente y se conserva la idempotencia existente de pedidos para una revisión/repetición explícita.

### Catálogo público estático: decisión

Es técnicamente viable generar una instantánea pública controlada desde los DTO públicos de catálogo. De implementarse, debe usar una lista explícita de campos (identificador público, nombre, categoría, descripción, ficha visible, imagen y alt), fecha de generación y versión; excluir usuarios, empleados, costos/lotes internos, credenciales, tokens y configuración fiscal privada. Si incluyera precio o disponibilidad orientativos, etiquetarlos como datos de la instantánea y nunca usarlos para autorizar compras. Express debe validar siempre precio/stock y reglas del pedido.

No se implementa esa exportación/sincronización en esta fase: no es necesaria para entregar fachada, navegación, contacto y recursos sin Render, y añade responsabilidad de actualización e información obsoleta. La tienda histórica `data/` no se copia ni se presenta como catálogo vigente. El catálogo dinámico continúa mostrando datos actuales cuando Express responde; no se promete que funcione durante su suspensión.

### Artefacto, configuración y reversión

`scripts/build-pages.cjs` copia únicamente HTML y extensiones permitidas del cliente, omite archivos ocultos, symlinks, uploads y briefs internos; genera configuración pública, CSP/caché y 404. No hace consultas de red o base de datos. La CLI solo reemplaza `dist/pages`; las pruebas permiten carpetas temporales con prefijo controlado. No se instala ninguna dependencia nueva. El script de frontend existente conserva la generación del estado de carga accesible.

La lista CORS remota, dominio Pages, origen público de imágenes y cualquier despliegue continúan pendientes de configuración autorizada. La salida no cambia las URL de producción ni `data/deployment.json`. Al introducir otro origen, sesión, carrito y preferencias empiezan independientes; no se trasladan tokens por URL. El enlace Render anterior sigue siendo la alternativa de regreso.

Los pasos exactos de publicación y reversión están en [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md). El respaldo y el commit inicial permiten revertir solo este patch, sin restaurar secretos ni bases de negocio. Las 16 navegaciones locales completas, sus límites y el empeoramiento observado con API caliente están en [RENDIMIENTO.md](RENDIMIENTO.md#separación-estática-preparada-para-cloudflare-pages). Con 30 s de indisponibilidad simulada, FCP fue 30.316 → 1.160 ms, pero los datos llegaron a los 31.225,7 ms en el estático. No equivale a medir Cloudflare real ni a resolver la disponibilidad de las API.

### Archivos de la fase

14 archivos existentes modificados, 13 añadidos y ninguno eliminado. El inventario completo de cambios y manifiesto del frontend de línea base están en [la evidencia JSON](pruebas/separacion-frontend-2026-10-21.json).

| Grupo | Archivos |
| --- | --- |
| Configuración y cliente | Nuevo `frontend/config.js`; cambios en `frontend/models/api.js`, `frontend/models/billing.js`, `frontend/views/products.js`, `frontend/views/admin.js`, `frontend/controllers/catalog.js`, `frontend/controllers/layout.js` y `frontend/index.html`. |
| Servidor y entorno | `server/config.cjs`, `server/app.cjs`, `.env.example`; CORS/CORP, sin cambio de autorización o persistencia. |
| Empaquetado/medición | Nuevos `scripts/build-pages.cjs` y `scripts/measure-pages.cjs`; `scripts/build-frontend.cjs`, `package.json` (solo script) y `.gitignore`. |
| Pruebas nuevas | `tests/reto2/api-client.test.cjs`, `cross-origin.test.cjs`, `pages-build.test.cjs`, `static-urls.test.cjs`, `pages-server.cjs`, `pages.config.cjs`, `pages.spec.cjs`. |
| Documentación/evidencia | Nuevos `docs/SEPARACION_FRONTEND_BACKEND.md`, `docs/DEPLOY_CLOUDFLARE.md` y JSON enlazado; actualización de `docs/RENDIMIENTO.md`. |

Las seis capturas históricas regeneradas por pruebas se restauran al contenido previo; la QA nueva queda en TEMP. `package-lock.json`, dependencias, Prisma, migraciones, `render.yaml`, datos y checkouts anidados permanecen sin cambios. La carpeta generada `dist/pages` se entrega aparte y no se versiona.

### Pruebas observadas

| Comando | Resultado |
| --- | --- |
| `npm test` | 170/170; incluye 31 casos nuevos de transporte, empaquetado, URLs y CORS. |
| `npm run test:reto1` | 34/34 históricos. |
| `npx playwright test --config tests/reto2/playwright.config.cjs frontend.spec.cjs performance.spec.cjs order-tracking.spec.cjs billing.spec.cjs` | 36/36; escritorio y móvil, sin omisiones ni casos flaky. Selección pertinente, no toda la suite de navegador del repositorio. |
| `npx playwright test --config tests/reto2/pages.config.cjs` | 20/20; diez contratos entre orígenes, en escritorio y móvil. |

Las pruebas de integración sirven el artefacto con su CSP en un puerto y Express en otro, con SQLite/uploads temporales. El servidor estático devuelve 404 para API, uploads y servidor: no hay un proxy que oculte errores de URLs o de CORS. Se bloquean terceros en esa suite. Los retrasos de 30 s se simulan con reloj/control de respuestas; la medición de rendimiento los verifica aparte con espera real.

| Escenario solicitado | Evidencia funcional |
| --- | --- |
| A. API activa | Catálogo real, navegación limpia, login/JSON/Bearer con preflight y lista CORS exacta. |
| B. API con demora de 30 s | Fachada y menú disponibles antes de datos; recuperación por foco después de liberar la API. |
| C. API que no responde | Error acotado tras dos intentos de lectura; no se inventan tarjetas ni se pierde carrito. |
| D. Sesión válida | Identidad de usuario/admin restaurada entre orígenes; compra oculta mientras el rol está pendiente. |
| E. Sesión vencida | 401 limpia token y conserva restricciones de acceso. |
| F. Visitante | Navega la información pública y consulta productos sin cuenta; pedido exige identidad. |
| G. Cliente con carrito | Cantidades persisten en el nuevo origen; un POST fallido conserva formulario/carrito y no se duplica. |
| H. Administrador | Rol, panel, CRUD y preview de imágenes conservados; RIDE de borrador se descarga autenticado mediante Blob. |
| I. Sin stock | Etiqueta/estado agotado y botón deshabilitado; validación de existencias permanece en backend. |
| J. Conexión fallida | Lectura pública con recuperación acotada, errores visibles; 503 de identidad conserva token y no concede compra. |

La ampliación de facturación usa únicamente emisor, comprador, pedido y BORRADOR sintéticos en la base temporal, sin firma ni emisión. Se conserva `no-store`, Bearer y control de propietario/admin. Las suites backend existentes siguen comprobando aislamiento entre usuarios y coherencia de pedidos.

La primera regresión detectó dos diferencias de formato del `src` de imágenes en mismo origen, corregidas conservando el path relativo original. Otros dos fallos fueron ENOENT de trazas porque dos configuraciones Playwright compartían salida; se aisló el directorio de artefactos de la nueva suite y se repitieron ambas. Los resultados de la tabla son las ejecuciones posteriores en verde. También se probó en rojo/verde la protección del empaquetador contra una junction en un antecesor; los datos sintéticos externos se conservan. No se ocultan esas incidencias como éxitos iniciales.

## Verificación de la integración remota

La base `1e55805` conserva sus funcionalidades y archivos históricos. Se verificaron 97 archivos que debían mantenerse; las optimizaciones se aplicaron mediante los cambios acotados descritos en esta guía. El empaquetador y el snapshot de medición conservan módulos `.mjs`; ambas regresiones se observaron fallar antes de aplicar sus arreglos y pasar después.

Las suites locales completas terminaron con **177/177 Node**, **38/38 históricas**, **54/54 navegador en el mismo origen** y **20/20 entre orígenes**, sin fallos ni omitidos. Usaron fixtures temporales; las capturas versionadas del remoto se restauraron. La [evidencia de integración](pruebas/integracion-cloudflare-2026-10-21.json) incluye comandos, límites y SHA-256 de logs locales. Esta comprobación funcional no ejecutó benchmarks ni acredita por sí sola un despliegue público.
