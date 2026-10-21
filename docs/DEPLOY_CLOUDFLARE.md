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
| Commit servido | 0672e414ca040afa43810e478e93502b834ff8da |
| Despliegue Pages | 8801c092-0a71-40f9-abeb-32b7cf2a97fd |
| URL inmutable | https://8801c092.farmacia-reyna-del-cisne-pruebas.pages.dev |
| Otras ramas | Previews automáticas desactivadas; despliegue automático solo desde la rama Pages elegida |

La actualización de prueba se publicó el 21 de octubre de 2026. El build Linux terminó con 94 archivos, 12.591.298 bytes y un máximo por archivo de 2.650.904 bytes. Cloudflare informó una duración de 29 s; el registro del build abarca de 17:36:36 a 17:37:02 UTC. Se subió un archivo nuevo y se reutilizaron 92 ya cargados; la regla de cabeceras fue válida. El alias de prueba apunta al despliegue de la tabla. No se instalaron dependencias ni se cambiaron variables de entorno, Functions o Workers.

El único recurso público modificado respecto del control fue `assets/images/farmacia-fachada-reina.webp`: compresión WebP de calidad 95, de 1.647.804 a 391.110 bytes (−76,26 %), manteniendo 1672 × 941 píxeles. No se modificaron HTML, CSS, JavaScript ni otros recursos. La revisión visual a 1440, 768 y 375 px conservó la geometría sin degradación material observada; no certifica equivalencia perceptual universal. [Evidencia de imagen](pruebas/lcp-imagen-2026-10-21.json) y [QA visual](pruebas/lcp-qa-visual-2026-10-21.json).

El build estático no necesita secretos ni instala paquetes, carga .env, genera Prisma, conecta una base, ejecuta migraciones o siembra datos. No se usa setup:production para Pages. Cloudflare documenta el [build estático y su salida](https://developers.cloudflare.com/pages/configuration/build-configuration/) y la variable para [omitir la instalación automática](https://developers.cloudflare.com/pages/configuration/build-image/#skip-dependency-install).

## Seguridad y contenido

El artefacto contiene nueve HTML públicos, módulos JavaScript y MJS, recursos locales, config.js público, _headers y 404.html. Excluye servidor, Prisma, dependencias, .env, uploads, certificados, backups y datos de usuarios. El shell administrativo no contiene registros privados ni concede permisos. RIDE/XML siguen siendo respuestas privadas y autenticadas de Express.

CSP permite scripts, estilos y fuentes propios, imágenes de los dos orígenes públicos exactos y el iframe Google existente. No se utilizan comodines, unsafe-inline, unsafe-eval, proxies, Workers ni Pages Functions. Las rutas HTML y limpias conservan navegación; 404.html evita el fallback SPA general. HTML y recursos sin versionar revalidan con max-age=0; API y documentos privados mantienen no-store. No se exporta el service worker de la tienda histórica.

JWT continúa en sessionStorage, con Authorization Bearer y credentials:omit. No se introducen cookies ni cambios SameSite. El origen nuevo empieza con sesión y carrito propios; no se trasladan tokens por URL.

La revisión del constructor y del artefacto publicado no encontró rutas privadas ni archivos fuera de la whitelist. Las comprobaciones heurísticas no prueban la ausencia universal de secretos. Los controles, resultados y límites de la auditoría están en [SEGURIDAD_DESPLIEGUE.md](SEGURIDAD_DESPLIEGUE.md).

## Render existente

Servicio srv-db5sg2ss728c738t3n6g, Free, Virginia, rama configurada main y URL anterior conservados. CORS_ORIGIN se guardó con los dos orígenes exactos: https://farmacia-reina-del-cisne.onrender.com y https://farmacia-reyna-del-cisne-pruebas.pages.dev. No se permiten previews arbitrarias ni *.pages.dev. La API permanece en /api y sigue verificando roles, propietario, precios, stock e idempotencia.

La lectura del panel confirmó IMAGE_STORAGE=supabase, SKIP_INITIAL_SEED=true y el origen público de imágenes de la tabla. No se copiaron secretos. Antes del parche, un HEAD a una referencia UUID sintáctica confirmó la redirección a /storage/v1/object/public/farmaciaproductos/ con CORP same-origin. Después del parche, un upload público real devolvió CORP cross-origin y su destino Supabase respondió 200 image/webp, sin autenticación. La política de las API y documentos privados sigue siendo same-origin.

Se publicó el commit mínimo 75aee3e67ca0e807e8047f5e53e9e9769275cac2 de codex/pages-public-images: una línea de middleware y tres pruebas. Pasó 144/144 pruebas sobre SQLite temporal y Render lo dejó Live en el despliegue dep-dbceq0uktt5c73f6satg. La opción de desplegar un commit específico desactivó Auto-Deploy; se confirmó Off y se conserva así durante la prueba para no reemplazar el backend validado por otro commit de main. Main no se modificó. Antes de una promoción futura deberá integrarse este parche en la rama de backend elegida y decidir el control automático correspondiente.

No hay cambios de esquema, migraciones, dependencias o credenciales en ese commit. El pipeline existente ejecutó migrate deploy y omitió seed, como se verificó en los logs. Node 22.23.4 procede del NODE_VERSION=22 que ya tenía Render; no se cambió esa variable. La base y las imágenes continúan en los servicios existentes.

Esta actualización de Pages no desplegó backend: Render sigue sirviendo `75aee3e67ca0e807e8047f5e53e9e9769275cac2`, despliegue `dep-dbceq0uktt5c73f6satg`, con `main` configurada y Auto-Deploy Off. El candidato completo `51d40d9293cfd54f3eaf372e1a191a5c55319e95` se publicó en la rama con `CF-Pages-Skip` y queda preparado para revisión; reúne el diagnóstico opcional previo, la atribución de escrituras administrativas y sus pruebas. Su código de servidor no forma parte del artefacto Pages y requiere autorización posterior antes de publicarse en Render.

`render.yaml` es la plantilla histórica, no una exportación del panel actual: contiene `autoDeployTrigger: commit` y CORS derivado solo del origen Render. No se reaplicó ni modificó infraestructura. Una promoción futura debe revisar esa diferencia antes de usar un Blueprint, para conservar Auto-Deploy Off y la lista CORS exacta vigente; desplegar un commit por el procedimiento controlado no autoriza reactivar el despliegue automático.

## Verificación y reversión

La integración conserva las funciones remotas ausentes del snapshot: asistente administrativo, ayuda contextual/responsive, eventos de carrito, estadísticas y tienda histórica. Todas las escrituras de las suites utilizan bases y uploads temporales. Los ensayos de suspensión y desconexión simuladas interceptan las peticiones del navegador de prueba. La observación pública de inactividad permite que actúe la suspensión natural del plan gratuito; no detiene Render ni usa pings para mantenerlo activo.

Validación local de esta actualización: 185 Node, 38 históricas, 54 navegador de un origen y 20 entre orígenes: 297 pruebas aprobadas, sin fallos ni omisiones. En el despliegue público pasaron 102 comprobaciones estáticas: 93 archivos, ocho rutas privadas y `/_headers` que respondieron 404, mediante 112 GET y sin fallos. El cliente publicado pasó además tres escenarios con una API y base temporal locales: restauración de sesión y logout, aislamiento por propietario y barrera administrativa. Esos escenarios no utilizaron cuentas válidas de Render.

La verificación pública anterior incluyó 18 GET estáticos, 10 comprobaciones API de solo lectura, dos HEAD de una imagen pública real y cinco escenarios de navegador: escritorio, móvil, API abortada, API retenida 30 s y sesión inválida/barrera administrativa. Se conserva como evidencia histórica, separada de esta actualización. Para la API real de esta etapa se ejecutaron y aprobaron 22 sondas anónimas, incluidas solicitudes con datos sintéticos destinadas a comprobar el rechazo de autenticación. No se usan cuentas válidas ni se realizan operaciones comerciales, altas reales, pedidos, facturas o cambios de stock; no corresponde describir esta verificación como exclusivamente GET.

Las sesiones válidas de cliente/admin, registro, ownership, compras, inventario y facturación se verificaron con fixtures temporales en las suites locales; no se presentan como operaciones privadas verificadas con cuentas reales en producción. No hay pasarela de pagos y no se emitió al SRI. La retención/desconexión de la verificación pública histórica se limitó al navegador de prueba: no se suspendió Render. Evidencias y límites históricos: [despliegue-cloudflare-2026-10-21.json](pruebas/despliegue-cloudflare-2026-10-21.json).

La comparación pública histórica registró LCP mediano Render de 9.368 ms frente a Pages de 5.828 ms; FCP de 1.856 ms en ambos. No es la línea base de esta optimización ni un resultado actual. El proxy del navegador varió, la API estaba activa y no se controló la caché CDN. En un ensayo funcional histórico distinto, retener solo la API 30 s permitió mostrar shell y menú a los 1.330 ms.

El nuevo control previo al cambio registró LCP mediano Pages de 4.180 ms y Render de 5.608 ms: tres pares secuenciales, caché del navegador desactivada, 1440 × 1000 px, red real más limitación a 10 Mbps/40 ms, sin límite de CPU y con fase proxy observada de 0 ms. Las cifras proceden de [lcp-publico-antes-2026-10-21.json](pruebas/lcp-publico-antes-2026-10-21.json). El control anterior y la medición posterior deben compararse bajo ese mismo perfil; no equivalen al percentil 75 de usuarios ni garantizan el tiempo de despertar de la API.

La medición posterior registró LCP mediano **Pages 1.436 ms** (1.436/1.372/1.712) y **Render 5.204 ms**, bajo el mismo perfil del control previo. Todas las muestras Pages cumplieron 2,5 s; el control Render conservó su código anterior. Son muestras de laboratorio, no p75 de usuarios. Los cinco escenarios públicos se repitieron sin fallos; las **22 sondas API aprobaron** preflight, CORS y rechazo sin autenticación, sin operaciones comerciales. Método y evidencias en [RENDIMIENTO.md](RENDIMIENTO.md#resultado-público-posterior-a-la-publicación) y [SEGURIDAD_DESPLIEGUE.md](SEGURIDAD_DESPLIEGUE.md).

Tras más de 15 min 30 s sin tráfico propio, la portada mostró LCP **1.668 ms** y el catálogo se recuperó automáticamente a los **31.378,3 ms**, con cuatro timeouts transitorios en las API. Los logs confirmaron proceso nuevo y la recuperación de productos en 111 ms dentro de Express por requestId. Es compatible con despertar de Free; no hubo evento explícito que pruebe la causa del reinicio. Las simulaciones de API retenida/desconectada permanecen separadas de esa observación real. La candidata frontend está preparada para una promoción autorizada; la publicación autorizada del parche de auditoría del backend y la política comercial de reservas pendientes siguen pendientes antes de una apertura completa.

Estado: URL de prueba publicada y verificada, con coste mensual adicional de USD 0 en los planes gratuitos existentes. La promoción de dominio/DNS y la activación comercial requieren aprobación posterior; no se ejecutaron. Render Free conserva su suspensión por inactividad: los datos dinámicos aún pueden tardar mientras despierta. No se añadieron pings para impedirlo.

Para revertir únicamente esta actualización, Pages conserva el commit anterior `28cbed850d242d0a0f268613c5057a70577af186`, despliegue `8c4a0c9e-710e-40f4-b50e-f1b5f850745e`. Esa reversión no requiere tocar Render: se conserva `75aee3e`, su CORS actual, la rama configurada `main` y Auto-Deploy Off. No se restaura On Commit. No requiere restaurar una base, cambiar credenciales ni borrar servicios. El dominio principal y DNS siguen intactos.

Las limitaciones gratuitas se documentan según [Pages](https://developers.cloudflare.com/pages/platform/limits/) y [Render](https://render.com/docs/free#spinning-down-on-idle): separar HTML no evita que la API suspendida tarde en responder. No se contratan servicios ni se activan planes de pago.
