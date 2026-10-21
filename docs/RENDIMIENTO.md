# Rendimiento: diagnóstico y primera corrección

Fecha: 2026-10-21. Alcance: inicio público MVC y diagnóstico HTTP; no es una medición de toda la plataforma ni una garantía de producción.

## Respuesta del sitio publicado

Origen confirmado por el propietario: `https://farmacia-reina-del-cisne.onrender.com`.

Un GET a `/` desde Windows x64/Node 24.15.0 estableció DNS, TCP y TLS, pero no recibió cabeceras HTTP durante el límite de 30 segundos. El corte se observó a los **30.034,50 ms**. DNS: 174,66 ms; TCP acumulado: 209,12 ms; TLS acumulado: 412,59 ms. La muestra comenzó a las 10:03:31 UTC−5.

No hay TTFB de respuesta completada, estado HTTP, LCP/FCP remoto, cabeceras de caché/compresión ni duraciones de API públicas. No se presentan esos campos como cero. Se detuvo el muestreo sin reintentar ni llamar otros endpoints.

`render.yaml` configura `plan: free`. [Render documenta la suspensión tras inactividad y su posterior arranque](https://render.com/docs/free#spinning-down-on-idle). Es una hipótesis compatible con la espera, **no una causa demostrada**. También faltan logs de arranque, eventos de instancia, configuración efectiva y diagnóstico de red/proveedor. Optimizar una imagen no puede eliminar una espera que ocurre antes de recibir HTML.

## Experimento local antes/después

- Misma máquina, Node 24.15.0 y Chrome instalado, viewport de escritorio 1440×1000.
- Tres muestras por variante/perfil, cada una con contexto nuevo, caché desactivada y service workers bloqueados.
- Express real, migraciones y semilla existentes sobre **SQLite temporal** mediante `tests/reto2/fixture.cjs`; uploads temporales. No se midió la base privada ni PostgreSQL remoto.
- Perfil local sin limitación y perfil CDP configurado a 10 Mbps de descarga, 5 Mbps de subida y 40 ms de latencia. No se simularon CPU ni distancia real a Render.
- Navigation/Resource Timing y observador de Largest Contentful Paint. El elemento LCP fue la fachada de la farmacia en las muestras de red limitada. Se esperó al catálogo, manifest de mascota y reposo de red.
- Los bytes son los observables en Resource Timing, incluyendo cabeceras locales. El iframe Google Maps es externo y sus bytes internos no son visibles sin permisos Timing-Allow-Origin; no se presentan estos valores como una captura completa de todo el tráfico de terceros.

Medianas de tres muestras:

| Métrica | Local antes | Local después | 10 Mbps antes | 10 Mbps después |
| --- | ---: | ---: | ---: | ---: |
| TTFB HTML, `responseStart-requestStart` | 1,8 ms | 1,9 ms | 1,4 ms | 1,3 ms |
| First Contentful Paint | 1.160 ms | 1.132 ms | 1.476 ms | 608 ms |
| Largest Contentful Paint | 1.192 ms | 1.184 ms | 9.304 ms | 4.948 ms |
| Evento load | 2.811,2 ms | 2.929,8 ms | 9.253,6 ms | 5.200,3 ms |
| Entradas de recursos | 60 | 58 | 60 | 58 |
| Transferencia observable | 10.758.005 B | 6.783.351 B | 10.758.005 B | 6.783.351 B |

La transferencia baja **36,95 %** y el LCP mediano con red limitada baja **46,82 %**. El evento load local no mejoró y el LCP local cambió muy poco: no atribuir todas las variaciones al parche. Tres muestras orientan el diagnóstico; no sustituyen percentiles de usuarios reales. El objetivo de LCP en 1–2 segundos **no quedó alcanzado bajo el perfil limitado**.

## API y Prisma locales

Antes de las correcciones se midieron tres GET por ruta, siempre con estado 200:

| Ruta | Cuerpo | Mediana hasta cabeceras | Mediana total |
| --- | ---: | ---: | ---: |
| `/api/productos?pageSize=100` | 15.177 B | 11,14 ms | 11,39 ms |
| `/api/productos?pageSize=4` | 3.262 B | 5,50 ms | 5,73 ms |
| `/api/promociones` | 2.347 B | 6,24 ms | 6,44 ms |

El cuerpo de productos que necesita la portada se reduce un 78,51 %. El catálogo completo y comparación siguen usando todas las páginas; precios, IVA, promociones y disponibilidad los calcula el backend existente.

La apertura inicial del cliente SQLite de prueba tardó 15,12 ms antes y 14,27 ms después; medianas de cinco `SELECT 1`: 0,50 ms y 0,38 ms. No se cambió Prisma: esas diferencias son variación del muestreo, no una mejora del ORM. `SELECT 1` mide un recorrido mínimo, **no descompone las consultas del catálogo ni representa PostgreSQL remoto**. No se instrumentaron tiempos SQL internos ni EXPLAIN/índices sobre producción.

## Cambios aplicados

1. La portada y su refresco solicitan cuatro productos con la paginación ya disponible. No cambian búsqueda, comparación ni catálogo completo.
2. La mascota descarga el atlas seleccionado; cambiar de personaje carga el suyo. Se conserva el comportamiento y las animaciones; no se eliminó el widget.
3. La fachada usa WebP lossless: **2.650.904 → 1.647.804 bytes**, manteniendo **1672×941** y todos los píxeles decodificados idénticos. Se conserva el PNG original y la tienda histórica. El cambio se realiza en el generador y en su salida `frontend/index.html`.

No se tocaron esquema, migraciones, datos, autenticación, rutas REST, caché privada, planes ni despliegue. No se agregó ninguna dependencia. Se reutilizó Sharp, ya presente.

## Reproducción y evidencias

Herramienta conservada: `scripts/measure-performance.cjs`. Desde la raíz y con dependencias/Chrome ya instalados:

```powershell
node scripts/measure-performance.cjs sample
```

Genera `%TEMP%/farmacia-performance-sample.json`, usa fixtures temporales y elimina su SQLite/uploads al terminar. Requiere el cliente Prisma SQLite generado de este proyecto. Cierra otras suites antes de comparar rendimiento; no ejecutar `setup:production`, seed o migraciones sobre la base privada para medir. El iframe de Maps existente puede efectuar una petición pública al navegar; no se envían correos, pagos ni facturas.

Las muestras originales (antes/después), APIs, conexión SQLite, recursos individuales, timeout remoto y resultado de auditoría de dependencias están en [rendimiento-2026-10-21.json](pruebas/rendimiento-2026-10-21.json). Los recursos locales conservan sus tamaños/duraciones; las URLs del LCP contienen el puerto temporal de cada ejecución.

Pruebas nuevas: `tests/reto2/performance.spec.cjs`. Antes del cambio fallaron los tres contratos esperados: página de 100 productos, precarga de tres atlas y fachada PNG. Después pasan los seis casos de escritorio/móvil. Las comprobaciones de regresión ampliadas se registran al cerrar esta iteración en la auditoría inicial.

## Pendiente de medir/decidir

- Logs y eventos Render para diferenciar arranque en frío de otros problemas anteriores al HTML; comparación fría/caliente sin tráfico artificial permanente.
- Latencia de conexión/consultas PostgreSQL, región efectiva de aplicación y base, configuración y límites de pool, volumen real e índices con planes de consulta.
- Login y restauración de sesión con cuenta de prueba; el arranque actual espera `/auth/me` cuando existe token. No cambiar roles/sesiones sin pruebas específicas.
- Catálogo grande, grafo JavaScript administrativo, políticas de caché/compresión del hosting, y redibujado continuo del canvas incluso pausado.
- FCP/LCP de producción, móvil real y percentiles de usuarios. No publicar ni contratar infraestructura automáticamente para completar estas mediciones.

## Investigación posterior: Render, arranque y bloqueo de la portada

Actualización del 2026-10-21. Esta sección amplía la primera auditoría: los pendientes anteriores describen lo conocido entonces. Se revisaron el panel privado de Render y el equipo accesible de Vercel después del inicio de sesión del propietario. No se desplegaron los cambios locales.

### Alojamiento efectivo y URL

El frontend MVC y la API están en **el mismo servicio Express de Render**, `https://farmacia-reina-del-cisne.onrender.com`; la API usa el prefijo `/api`. La URL se obtiene de `data/deployment.json`, sin consultar ni copiar secretos. `server/app.cjs` sirve `frontend/`; `frontend/models/api.js` hace peticiones relativas a `/api`. No hay una URL de API de Render consumida por un frontend Vercel en la configuración activa.

El panel confirma servicio Node, **Free**, región **Virginia (US East)**, health check `/api/salud`, arranque `npm start` y compilación `npm ci --include=dev && npm run setup:production`. El despliegue visible corresponde al commit `1e5580596e89d0bac591a773210e99b220fd0dd0`, del 16 de octubre. Auto-deploy está activo al hacer commit en la rama configurada: no se hizo push. Estos valores son lectura del panel, no cambios de infraestructura.

En el equipo de Vercel abierto no apareció un proyecto coincidente al buscar la farmacia; por tanto no hay logs de funciones Vercel de esta aplicación que correlacionar allí. Esto no demuestra que no existan otros equipos o despliegues privados. GitHub Pages conserva una redirección de página completa al origen configurado; no constituye un frontend separado que consuma esta API. El servidor desplegado utiliza PostgreSQL según su log de arranque; la región efectiva de la base y sus límites de conexiones siguen sin comprobarse.

### Medición pública y correlación con Express

Se hicieron solamente cuatro GET secuenciales, sin reintentos, con `curl.exe 8.21.0`, TLS verificado, conexiones nuevas y `--compressed`. La primera petición permitió hasta 60 s para observar qué sucedía después del corte original de 30 s; las restantes, 30 s. No fue una prueba de carga.

| Petición | HTTP | TTFB cliente | Total cliente | Express en logs |
| --- | ---: | ---: | ---: | ---: |
| `/`, primera | 200 | 33.113,93 ms | 33.114,32 ms | **6 ms** |
| `/`, inmediata siguiente | 200 | 452,20 ms | 452,50 ms | **1 ms** |
| `/api/salud` | 200 | 346,99 ms | 347,15 ms | **4 ms** |
| `/api/productos?pageSize=4` | 200 | 451,78 ms | 452,09 ms | **136 ms** |

La correlación se hizo por `X-Request-Id`: primera raíz `fd9f1819-47b9-496e-b34f-435351f4fc81`, segunda `2ca7b344-6983-4fd8-b91b-67c7d839a980`, salud `b69cabcc-a0c1-4500-bc0f-7d7f74e5da9e`, productos `a2262f68-ad01-4333-9482-2001ebed29bc`. El reloj del cliente y la cabecera Date difieren aproximadamente 86 s; no se restaron sus horas absolutas.

En la primera raíz DNS terminó a los 160,98 ms, TCP a los 208,61 ms y TLS a los 673,11 ms. Quedaron unos **32.440,82 ms entre TLS y el primer byte**. Esto contiene red/proxy, disponibilidad/encolado del servicio y procesamiento; no es una medición pura de ninguna de esas partes. Los 6 ms del mismo request en Express descartan que el procesamiento de esa ruta explique los 33 s. La raíz sirve HTML estático y no consulta Prisma. Tampoco puede explicarse esta espera inicial por una API que el navegador aún no ha podido solicitar.

En Render, hora del panel UTC−5:

| Hora | Instancia | Evidencia |
| --- | --- | --- |
| Hasta 10:17:19 | `pvfx6` | Health checks normalmente de 4–9 ms. |
| 10:18:07 | `6fz9m` | `Running npm start`. |
| 10:18:09 | `6fz9m` | Inicio de `node server/index.cjs`. |
| 10:18:14 | `6fz9m` | Mensaje PostgreSQL y servidor escuchando. |
| 10:18:22 | `6fz9m` | Primer health check de 598 ms; primera raíz correlacionada de 6 ms. |
| 10:18:23–24 | `6fz9m` | Segunda raíz 1 ms, salud 4 ms, productos 136 ms. |
| Después | `6fz9m` | Health checks cada cinco segundos, principalmente 3–10 ms, sin errores en el intervalo revisado. |

**Confirmado:** se inició una instancia nueva antes de atender la petición lenta; la mayor parte de la espera ocurrió antes del tramo medido por Express. Es un mecanismo capaz de producir demoras intermitentes al abrir esta URL. No se capturó la navegación original de aproximadamente 15 s, por lo que no se atribuye retrospectivamente su duración exacta.

**Hipótesis pendiente:** suspensión por inactividad. El plan efectivo es Free y [Render documenta suspensión tras 15 minutos sin tráfico entrante y reactivación de aproximadamente un minuto](https://render.com/docs/free#spinning-down-on-idle). Los logs observados no indican expresamente por qué cambió la instancia: no permiten distinguir suspensión, reinicio de plataforma u otra causa. No se vio un nuevo deploy, excepción, timeout Prisma ni fallo de conexión en el intervalo inspeccionado; esa ausencia no descarta incidentes fuera del intervalo. Los 598 ms iniciales de salud incluyen toda su ejecución y una consulta: no son 598 ms de SQL ni prueban un problema de conexión.

Las respuestas públicas ya tienen gzip. HTML: `Cache-Control: public, max-age=0`; API: `no-store`. No se añadió una dependencia de compresión ni caché compartida para datos privados. La diferencia cliente/Express incluye la ida y vuelta por TLS, Cloudflare y Render; no debe llamarse latencia de base de datos.

### Solicitudes iniciales y dependencias

La captura local contiene 58 entradas Resource Timing con caché vacía; su inventario individual está en el JSON de evidencia. No es una captura HAR de la navegación pública ni cuenta el tráfico interno del iframe externo.

| Solicitud/grupo | Cuándo y para qué | ¿Debe impedir mostrar la portada? |
| --- | --- | --- |
| `/`, CSS, fuentes, imágenes de estructura y módulos de `controllers/app.js` | Construcción, estilo y lógica de la página. Los imports estáticos también incluyen controladores de otras pantallas. | HTML/CSS y el módulo de inicio sí son necesarios para sus respectivas partes; la fachada puede determinar el LCP. Separar el grafo JavaScript queda como propuesta a medir. |
| `/api/productos?pageSize=4` e imágenes de esas tarjetas | Productos destacados y precios/stock calculados por el servidor. | Necesaria para las tarjetas reales; no para cabecera, fachada, navegación y contacto. Se conserva el estado de carga/error. |
| `/api/auth/me` | Solo cuando hay token en sessionStorage; verifica identidad y rol. | Necesaria para acciones dependientes del rol. **La portada pública ya no la espera.** Las pantallas protegidas conservan su espera y autorización. |
| `/api/promociones` y sus imágenes | Sección de campañas, después de obtener destacados. | Puede terminar después. Ahora su petición pendiente tampoco bloquea el registro/refresco independiente del stock. |
| Módulo de mascota, manifest y atlas seleccionado | Widget después de conocer la sesión, para visitante/cliente. | Puede esperar; no se inicia mientras siga pendiente el rol. No se eliminaron personajes. |
| Iframe Google Maps | Ubicación, con la carga diferida existente. | Puede cargar después y no interviene en la obtención de productos. |
| Refrescos productos/promociones | Temporizador existente, foco/visibilidad y eventos de actualización. | Se ejecutan después, con la protección existente de una petición en curso por watcher. |

No se añade un GET de salud al navegador, un ping para mantener vivo Render ni una nueva API de diagnóstico. La salud observada en el panel procede del health check del hosting y de la medición explícita.

### Correcciones locales de bajo riesgo

1. `frontend/controllers/app.js` inicia layout, contacto y contenido público de inicio mientras `auth.restore()` verifica la sesión. `layoutController()` devuelve su actualización existente para aplicar el rol al resolverse, sin registrar listeners duplicados. Durante la espera se ocultan las acciones de cliente mediante `data-session-pending`; un 503 conserva el token y esa protección. Un 401 conserva el tratamiento de sesión inválida. No se convierte un fallo de autenticación en permiso de compra.
2. `frontend/controllers/catalog.js` utiliza watchers independientes de productos y campañas. Una campaña lenta o fallida no detiene la actualización del stock. Se reutiliza el watcher existente y su control de concurrencia.
3. Instrumentación optativa descrita a continuación. No se cambian esquema, índices, migraciones, paquetes, diseño ni infraestructura. Las cuatro capturas históricas que regeneran los tests se restauran a los bytes previos a esta iteración.

### Instrumentación temporal y límites de atribución

`server/diagnostics.cjs` concentra el diagnóstico; está **desactivado por defecto**. Solo `PERF_DIAGNOSTICS=1` lo habilita. Reiniciar es necesario para registrar el listener de consultas de Prisma. No hay interruptor HTTP. Para la primera fase `process_start`, establecer la variable antes de iniciar Node: si se activa únicamente desde `.env`, dotenv se carga después y el primer evento será `config_ready`, cuyo `uptimeMs` conserva el tiempo desde el arranque del proceso.

| Capa | Medición disponible | Interpretación/límite |
| --- | --- | --- |
| Red y disponibilidad exterior | curl DNS/TCP/TLS/TTFB/total y Request-Id; Navigation/Resource Timing en laboratorio. | La diferencia con Express incluye red, proxy, cola y disponibilidad. No separa esas partes por sí sola. |
| Proceso/arranque | Eventos `startup` por fase, `bootId`, hora y `uptimeMs`; señal de cierre y fallo de inicio sin error privado. | Distingue procesos y tiempo transcurrido; Render Events debe explicar la causa del nuevo proceso. |
| Express | `http_start`, `http_headers`, `http_finish`, cierre prematuro; `Server-Timing: express_headers;dur=…`, `X-Diagnostic-Boot`. | Reloj monotónico; desde entrada al logger hasta cabeceras/fin. No mide la cola anterior al middleware ni la descarga completa hasta el navegador. |
| Conexión Prisma | `prisma_connect` con duración y éxito de `$connect()` explícito en el laboratorio existente. | El harness mide SQLite temporal. **No se fuerza conexión ni prewarm antes de escuchar en producción**, que mantiene la conexión lazy. La conexión remota/pool sigue pendiente de medir. |
| Consultas | Eventos `sql` con ordinal y `queryRoundTripMs`, mediante `$on('query')` de Prisma 6. | Es duración de ida y vuelta según Prisma, no CPU/ejecución SQL pura. No lleva requestId: con concurrencia no se suman eventos globales como si fueran de una sola petición. |

La documentación de [eventos de Prisma 6](https://www.prisma.io/docs/orm/v6/reference/prisma-client-reference#event-types) especifica la duración del recorrido de consulta. Para aislar SQL en PostgreSQL hacen falta planes/estadísticas del servidor sobre consultas concretas; no se inventa esa separación a partir de tiempos HTTP. Prisma 6.19.3 dispone de `$on`; no se usó `$use` retirado ni una API de Prisma 7/8.

Los nuevos eventos no registran SQL, parámetros, URLs de conexión, errores internos, cuerpos, cookies ni Authorization. Las rutas de diagnóstico son una lista fija de rutas públicas/autenticación sin query string; otras se registran solo como `api` o `static`. Se mantienen los logs HTTP anteriores cuando el flag está apagado. La raíz no ejecuta SQL incluso con diagnóstico activo. Sigue habiendo **un único PrismaClient compartido por módulo** en el runtime; scripts y fixtures independientes crean sus clientes fuera del servidor de peticiones.

Se comprobó además con una ejecución local aislada, secuencial y con flag activo: conexión SQLite **25,75 ms**; raíz sin eventos SQL; salud con uno, productos con siete y promociones con cinco. Sus duraciones de consulta fueron de 0–1 ms según la resolución del evento de Prisma (cero no significa ausencia de trabajo). `Server-Timing` registró respectivamente 8,75; 12,94; 24,66 y 9,63 ms. Son muestras de funcionamiento de la instrumentación, con sobrecarga de logging y SQLite, **no tiempos PostgreSQL ni una comparación de mejora**. Los eventos completos están en `localDiagnosticProbe` del JSON.

Ejemplo local reproducible, sin tocar la base privada:

```powershell
$env:PERF_DIAGNOSTICS='1'
node scripts/measure-performance.cjs diagnostic
Remove-Item Env:PERF_DIAGNOSTICS
```

El harness usa el fixture SQLite temporal ya existente. Para desactivar el diagnóstico de un proceso, quitar la variable o establecerla a `0` y reiniciar. La instrumentación queda local y optativa, lista para una eventual validación autorizada; **no se habilitó ni desplegó en Render**. Los tests verifican que el arranque real no introduce `$connect()`/consultas previas a escuchar, que el flag apagado no añade cabeceras y que los eventos no filtran valores sintéticos sensibles.

### Comparación nueva bajo condiciones equivalentes

Se comparó la versión local al comenzar esta investigación (ya incluía las tres optimizaciones de la auditoría inicial) con la corrección de sesión/campañas. Mismo harness, máquina, Chrome, SQLite temporal, viewport 1440×1000, caché vacía, tres contextos por perfil y mismas condiciones de red de la primera sección. Las suites se ejecutaron después de medir.

| Mediana, visitante sin token | Local antes | Local después | 10 Mbps/40 ms antes | 10 Mbps/40 ms después |
| --- | ---: | ---: | ---: | ---: |
| TTFB HTML | 1,7 ms | 1,8 ms | 1,6 ms | 1,8 ms |
| FCP | 1.164 ms | 1.140 ms | 624 ms | 1.468 ms |
| LCP | 1.164 ms | 1.192 ms | 4.976 ms | 5.796 ms |
| Load | 2.654 ms | 3.007,3 ms | 5.206,6 ms | 6.074,4 ms |
| Recursos | 58 | 58 | 58 | 58 |
| Transferencia observable | 6.783.351 B | 6.783.668 B | 6.783.351 B | 6.783.668 B |

**No se demuestra una mejora general del LCP de visitante en esta iteración.** El perfil limitado empeoró 820 ms en estas tres muestras; no se oculta ni se atribuye automáticamente a red o al parche. Hay variación de ejecución y la corrección aborda la espera de sesión, sin reducir los recursos. La diferencia de código transferido es de 317 B. Estas muestras tampoco demuestran una regresión sistemática ni sustituyen datos de usuarios reales. La primera mejora de peso/LCP queda documentada separadamente, sin mezclar bases de comparación.

Para aislar el bloqueo corregido se hizo otro experimento: cuenta admin real **del fixture temporal**, tres contextos nuevos por versión y respuesta real de `/auth/me` retenida **3.500 ms deliberadamente**. Se midió desde navegación hasta cuatro tarjetas visibles, no el LCP. Mediana **4.998,53 → 1.219,97 ms** (reducción de 3.778,56 ms). Después se confirmó el rol admin y la compra oculta. Es una prueba controlada del desbloqueo; no afirma que `/auth/me` tarde 3,5 s en producción.

La primera/segunda raíz pública de 33,11 s y 0,45 s se midieron sobre **el mismo despliegue remoto**. No son un antes/después del parche ni una prueba de que el código local elimine el arranque de Render.

### API lentas, propuestas y datos que faltan

El candidato medido es productos: **136 ms de Express** frente a 1 ms del HTML y 4 ms de salud caliente. Una sola muestra no determina p95 ni cuánto corresponde a PostgreSQL, serialización, pool o red hacia la base. No se justifican índices, cambios de pool ni reescrituras con estos datos. El singleton existente no necesita una corrección de instancias por petición. La consulta reducida de cuatro productos, ya aplicada, sigue siendo la optimización medida de transferencia del inicio.

En lectura del código, productos realiza tres operaciones Prisma en una transacción: página con relaciones de lotes/promociones, conteo y tarifa fiscal. Promociones consulta tarifa y campañas con relaciones en paralelo. Los cálculos siguientes son en memoria; no se encontró un bucle N+1 explícito. Los `include` pueden producir varias sentencias, como también muestra el laboratorio, sin que eso demuestre N+1. Posibles mediciones futuras: columnas necesarias de relaciones, tarifa repetida entre ambas API y costo del conteo paginado. No se altera el contrato de la API ni se aplica caché fiscal sin demostrar costo y consistencia.

Orden de trabajo propuesto:

1. Confirmar con Render el motivo del cambio de instancia. Se necesita el evento del servicio alrededor de **10:17–10:19 UTC−5 del 21/10/2026**, con hora, tipo, causa/reason y estado anterior/nuevo, y cualquier línea de señal de cierre, límite de memoria o fallo de health check. El panel de logs revisado sí fue accesible; la vista Events revisada no mostró una causa explícita para este arranque. [Render documenta las vistas y retención de logs](https://render.com/docs/logging).
2. Si se autoriza una validación desplegada, usar durante un intervalo corto los eventos seguros y correlacionar las API de inicio con su requestId y bootId. Aportar duraciones/conteos anonimizados y eventos de instancia; no contraseñas, tokens, `.env`, `DATABASE_URL`, SQL con datos privados ni HAR sin limpiar.
3. Para conexión/SQL remoto, confirmar solo región de la base, modo directo/pooler, límites de conexión, versión de PostgreSQL y métricas de conexiones/esperas/consultas agregadas del intervalo. Con una consulta realmente lenta identificada, revisar su plan de lectura en un entorno autorizado. No se hizo EXPLAIN ni se añadieron índices a la base privada.
4. Si se confirma suspensión como causa, valorar un servicio sin suspensión o separar los estáticos del backend para que la portada llegue mientras la API inicia. Son **propuestas de infraestructura sujetas a autorización**, sin contratación ni implementación. Separar hosting también exige revisar URL de API y CORS; no se presupone Vercel.
5. Capturar una navegación afectada con hora, URL, caché/sesión y tiempos del documento y API para vincular los aproximadamente 15 s observados a una causa concreta. Si hay otro frontend Vercel, basta la URL pública y proyecto/equipo correcto con lectura de logs; el equipo inspeccionado no lo mostró.

Evidencia completa de esta ampliación: [diagnostico-render-2026-10-21.json](pruebas/diagnostico-render-2026-10-21.json), con muestras HTTP, mediciones locales, sesión retardada y transcripción estructurada de las líneas relevantes del panel, sin secretos. La interpretación inicial guardada junto a las mediciones HTTP se conserva como registro de adquisición; `renderDashboard` y `updatedInterpretation` incorporan la lectura posterior de logs.

### Verificación de esta iteración

La suite Node (`npm test`) finalizó con **139/139**, y la histórica (`npm run test:reto1`) con **34/34**. Los tres tests diagnósticos se repitieron tras el último ajuste de metadatos de rutas y pasaron. Playwright aprobó **30/30** casos de `frontend.spec.cjs`, `performance.spec.cjs` y `order-tracking.spec.cjs`, en escritorio y móvil. No se presenta esta selección como toda la suite de navegador del proyecto.

Los tres nuevos contratos de navegador fallaron antes del cambio y pasan después: tarjetas disponibles con sesión retenida, 503 sin compra visible ni borrado del token, y refresco de stock sin esperar promociones. Se revisó el código independientemente; no se detectaron regresiones materiales. La comparación de hashes con el respaldo del comienzo de esta investigación confirma 12 archivos modificados, tres añadidos y ninguno eliminado, sin cambios en paquetes/lockfile, esquemas, migraciones, `render.yaml` ni checkouts anidados. Las cuatro capturas regeneradas se restauraron. No se ejecutaron cargas agresivas, consultas a datos privados, despliegues, contratación ni cambios de infraestructura.

## Separación estática preparada para Cloudflare Pages

Actualización posterior del 2026-10-21. Se preparó localmente `dist/pages/`, sin publicar ni modificar Render, DNS o cuentas de hosting. Diseño, dependencias, seguridad y reversión: [SEPARACION_FRONTEND_BACKEND.md](SEPARACION_FRONTEND_BACKEND.md). Configuración manual: [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md).

El origen de API del frontend es configurable al generar la salida; desarrollo conserva el mismo origen. Se centralizan Fetch JSON, descargas privadas y referencias de imágenes subidas. El artefacto entrega HTML, CSS, fuentes, imágenes y módulos sin consultar Express; productos, identidad, stock, pedidos, administración y facturas siguen dependiendo del backend. No se exporta un catálogo histórico ni se crea un servicio de sincronización.

### Método nuevo, separado de las mediciones anteriores

Herramienta: `scripts/measure-pages.cjs`. **16 navegaciones**: tres por variante/perfil con API activa (local y 10 Mbps/40 ms) y una por variante para cada caso de demora de 30 s y ausencia de respuesta (solo red local). Chrome **155.0.8059.86**, Node **24.15.0**, escritorio 1440×1000, contextos nuevos, caché desactivada, service workers bloqueados y sin limitación de CPU. Nuestras suites estaban cerradas durante la medición; no se controla toda la actividad del equipo del usuario.

Se utilizó una sola SQLite temporal ya conectada, migrada y sembrada con fixtures, nunca PostgreSQL privado. Dos listeners loopback: el primero sirve Express/API y el frontend anterior, el segundo exclusivamente la salida estática con su CSP. El gateway retiene las respuestas del origen acoplado o solo la API del separado hasta 30 s desde el inicio controlado de navegación; el caso sin respuesta acepta HTTP pero nunca envía cabeceras. No se detiene ni suspende Render para provocar estos resultados.

La versión anterior se congeló desde el frontend original antes de sincronizar los cambios: **86 archivos**, manifiesto SHA-256 `1c44b4d1c6181af1e6b3d34570ea2be9a4ac62930b3f2d74dd698176334e5a7f`. Ya incluía las optimizaciones y correcciones de la investigación anterior. Se conservaron los mismos datos y cálculos del servidor. El experimento compara el conjunto de esta separación local; no atribuye cada diferencia de rendimiento a un único cambio de código.

Todos los terceros, incluido Maps, se bloquearon en ambas variantes. FCP y último candidato LCP se observaron sin clicks, foco ni teclado; el menú se considera inicializado cuando layout escribe `data-session-role`. Su uso real se comprueba en los tests, no alterando el LCP del ensayo. Las ventanas de observación son 35 s en demora y 25 s sin respuesta. Cuando no llega HTML se registra `null`; se evita evaluar una página cuya navegación no creó documento. Un primer intento del harness quedó esperando esa evaluación y se detuvo; **solo la ejecución posterior completa se conserva como evidencia**.

Los bytes nuevos proceden de `CDP Network.loadingFinished.encodedDataLength` para ambos orígenes, incluido el documento y sus cabeceras. **No son directamente comparables** con Resource Timing de las secciones previas. No incluyen tráfico de terceros bloqueado ni transporte TCP/TLS; las respuestas pendientes/fallidas no representan transferencia completa. No se interpreta una respuesta ausente como ausencia de tráfico.

### API activa: medianas de tres muestras

| Métrica | Acoplado local | Estático local | Acoplado 10 Mbps/40 ms | Estático 10 Mbps/40 ms |
| --- | ---: | ---: | ---: | ---: |
| TTFB documento, desde requestStart | 3,0 ms | 3,1 ms | 2,9 ms | 2,6 ms |
| FCP | 396 ms | 1.204 ms | 624 ms | 1.484 ms |
| Último LCP observado | 396 ms | 1.224 ms | 4.948 ms | 5.816 ms |
| Cuatro tarjetas disponibles | 497,3 ms | 1.288,4 ms | 1.498,6 ms | 2.241,1 ms |
| Peticiones de ambos orígenes, incluido HTML | 58 | 59 | 58 | 59 |
| Bytes codificados observados | 6.841.797 B | 6.835.360 B | 6.841.797 B | 6.835.360 B |

**La separación no demostró mejora de velocidad con API caliente en este laboratorio.** FCP y LCP empeoraron en estas muestras; el LCP limitado aumentó **868 ms**. Los 6.437 B menos incluyen diferencias de cabeceras de los servidores locales, por lo que no se presentan como una optimización del peso de imágenes. Tres muestras y sus variaciones no identifican la causa de la diferencia, pero el resultado desfavorable es material y debe conservarse en la evaluación previa a publicar.

Queda perfilar el grafo de imports, orden/prioridad de recursos e inicio de las secciones dinámicas, y contrastar el resultado en el hosting real una vez autorizado. No se atribuye automáticamente a Cloudflare, a una consulta SQL o a un único módulo. No se afirma que se haya alcanzado un objetivo general de LCP de 1–2 s, especialmente con red limitada.

### Backend demorado o sin respuesta: una muestra por caso

| Escenario | FCP | Último LCP | Menú inicializado | Cuatro tarjetas |
| --- | ---: | ---: | ---: | ---: |
| Acoplado, disponibilidad retenida 30 s | 30.316 ms | 30.336 ms | 30.342,4 ms | 30.411,1 ms |
| Estático, solo API retenida 30 s | **1.160 ms** | **1.192 ms** | **1.200,7 ms** | **31.225,7 ms** |
| Acoplado, sin respuesta durante 25 s | No llega HTML | No disponible | No disponible | No disponible |
| Estático, API sin respuesta durante 25 s | **1.200 ms** | **1.200 ms** | **1.219,9 ms** | No llegan datos; cero tarjetas |

El TTFB de documento fue 29.112,9 ms frente a 2,9 ms en el caso de demora; sin respuesta fue ausente frente a 2,0 ms. FCP/LCP y tarjetas usan el reloj de navegación; TTFB usa `responseStart-requestStart`, que excluye fases anteriores del navegador. El gateway se inicia con el reloj monotónico del harness, por eso el TTFB no tiene que ser exactamente 30.000 ms.

**Confirmado en el modelo local:** entregar los estáticos desde un origen independiente permite mostrar la portada antes de que la API esté disponible. **No acelera el arranque del backend ni hace funcionar sus operaciones durante una suspensión.** En el caso de 30 s, los datos del estático llegaron a los 31,23 s tras sus timeouts/refresco controlado, incluso algo después de la versión acoplada. En el caso sin respuesta el visitante conserva información estática y ve un error accesible, sin productos ni precios inventados. El menor tráfico observado en ese caso corresponde también a imágenes dinámicas que no llegaron a solicitarse, no a una nueva compresión de recursos.

### Límites, reproducción y pruebas

El laboratorio **no mide Cloudflare real**, CDN, caché de borde, HTTPS de Pages, región del visitante ni un arranque nuevo de Node/Prisma remoto. Antes de activar la separación faltan autorización de despliegue, URL Pages real, CORS exacto y origen público de imágenes remotas cuando corresponda. No se confirmaron esas imágenes en la configuración local; la guía exige configurarlas antes de utilizarlas. La evidencia no elimina las hipótesis sobre la causa del arranque de instancia investigado anteriormente.

Para reproducir, restaurar aparte el respaldo de línea base y pasar su directorio `frontend`; no usar los archivos ya modificados como supuesto “antes”:

```powershell
node scripts/measure-pages.cjs replica --baseline-root 'RUTA_A_LA_LINEA_BASE/frontend'
```

La herramienta exige explícitamente esa ruta, crea fixtures y listeners temporales, bloquea terceros y guarda el JSON en TEMP. No realiza peticiones a servicios públicos. Cerrar las suites durante la medición. El detalle de las 16 navegaciones, errores, bytes y manifiesto está en [separacion-frontend-2026-10-21.json](pruebas/separacion-frontend-2026-10-21.json).

Validación final: **170/170 Node**, **34/34 históricos**, **36/36 navegador existente seleccionado** y **20/20 navegador entre orígenes**. Incluye roles, token vencido/503, carrito, stock agotado, upload público, descarga RIDE privada sin emisión, POST sin duplicación, timeout de cuerpo, reintentos acotados, CORS/preflight, CSP, 404 y exclusión de archivos privados. Los relojes simulados de la suite funcional se distinguen de los 30 s reales del benchmark. No se ejecutó toda la colección de specs del repositorio ni se probaron pagos, servicios fiscales reales o datos privados.

## Perfilado posterior del LCP con API caliente

Se investigó el resultado desfavorable anterior sin modificar el frontend ni acceder a servicios públicos. Se restauró en TEMP el frontend del ZIP original y se confirmó el mismo manifiesto de 86 archivos: `1c44b4d1c6181af1e6b3d34570ea2be9a4ac62930b3f2d74dd698176334e5a7f`. Chrome 155, Node 24.15.0, viewport 1440×1000, 10 Mbps/40 ms, contextos nuevos, caché desactivada y la misma SQLite temporal por comparación. Las suites estuvieron cerradas durante las 20 navegaciones de perfilado.

El waterfall CDP encontró una espera de **822–876 ms en la fase de resolución de proxy**, antes de DNS, conexión y envío del documento. Esa fase no está incluida en el TTFB que calculábamos como `responseStart-requestStart`. En los casos lentos, el HTML terminaba alrededor de 0,9 s; solo entonces se descubrían CSS, fuentes, imports e imagen principal. Los casos rápidos de cualquiera de las dos variantes tuvieron cero demora de proxy y FCP alrededor de 0,6 s. No se consultó ni modificó la configuración del proxy del sistema; CDP identifica la fase, pero no demuestra si su mecanismo concreto es PAC, WPAD u otro resolver.

Un control cambió **solo el lanzamiento del Chrome temporal del laboratorio** mediante `--no-proxy-server`. Los listeners y todas las peticiones permitidas siguieron siendo loopback; terceros bloqueados. Se mantuvieron los mismos archivos de producto, datos, perfil de red y orden acoplado/Pages. Medianas de tres pares, sin traza:

| Métrica | Proxy del navegador, acoplado | Proxy del navegador, Pages | Loopback directo, acoplado | Loopback directo, Pages |
| --- | ---: | ---: | ---: | ---: |
| Fase proxy del documento | 821,82 ms | 849,31 ms | 0 ms | 0 ms |
| FCP | 1.504 ms | 1.460 ms | 648 ms | 628 ms |
| Último candidato LCP | 5.764 ms | 5.748 ms | 4.924 ms | 4.952 ms |

**El desfase de 868 ms no persistió al controlar esa fase local.** Con loopback directo quedó una diferencia de 28 ms de LCP y −20 ms de FCP en estas tres parejas; no se presenta como mejora, equivalencia estadística ni rendimiento de usuarios reales. La captura histórica no registró la resolución de proxy: conservamos sus 4.948 → 5.816 ms y no reconstruimos retrospectivamente el tiempo exacto de cada fase. El nuevo experimento demuestra un confusor capaz de producir esa magnitud, que también afecta a la variante acoplada.

El elemento LCP final fue siempre la misma fachada WebP, con 225.120 píxeles visibles. No aparecieron tareas largas del navegador de más de 50 ms. Las trazas incluyen CSS, fuentes, imports, prioridades y finalización de la imagen; no aportan evidencia para reescribir módulos, fuentes o renderizado del producto. Se capturaron seis navegaciones con proxy del navegador y dos con control directo usando traza; son observaciones adicionales, separadas de las seis más seis sin traza. La instrumentación puede añadir sobrecarga y no sustituye la comparación sin traza.

La recomendación es corregir el control del laboratorio y registrar la fase proxy, no cambiar el frontend por esta diferencia. Esto no elimina el coste real de descargar la fachada ni garantiza un LCP de 1–2 s con red limitada. Tampoco explica el arranque remoto de Render: aquella petición se investigó por separado y este control solo afecta a un Chrome temporal con listeners locales. La evidencia previa de API demorada/sin respuesta sigue conservada, sin nuevos sondeos de indisponibilidad.

### Reproducir el perfilado

`scripts/measure-pages.cjs` añade `--diagnostics` para waterfall CDP sin cabeceras/cuerpos, fase proxy, tiempos de navegación, candidato LCP con elemento/ruta, tareas largas y eventos de fuentes. `--trace` implica diagnóstico y guarda la traza Chrome en una carpeta nueva de TEMP con SHA-256; puede contener metadatos locales y no se copia al repositorio. `--direct-loopback` solo cambia el proceso Chrome de este harness, con comprobación de listeners loopback y terceros bloqueados; nunca configura el sistema ni permite probar URLs públicas. Sin esa opción se conserva el comportamiento anterior con el resolver del navegador.

Después de restaurar el ZIP aparte, sustituir `$baseline` si se eligió otra carpeta. Desde la raíz del proyecto y con las suites cerradas:

```powershell
$baseline=Join-Path $env:TEMP 'farmacia-warm-profile-679cb96ebb0a4686b6fcc93bb1d7e34b/frontend'
node scripts/measure-pages.cjs perfil-sistema --baseline-root $baseline --active-samples 3 --scenarios active --profiles 10Mbps-40ms --diagnostics
node scripts/measure-pages.cjs perfil-directo --baseline-root $baseline --active-samples 3 --scenarios active --profiles 10Mbps-40ms --diagnostics --direct-loopback
node scripts/measure-pages.cjs perfil-traza --baseline-root $baseline --active-samples 1 --scenarios active --profiles 10Mbps-40ms --trace --direct-loopback
```

La evidencia resumida, las muestras individuales, el SHA del ZIP y los SHA de ocho trazas están en [perfil-lcp-2026-10-21.json](pruebas/perfil-lcp-2026-10-21.json). Las trazas originales permanecen en `%TEMP%/farmacia-warm-profile-679cb96ebb0a4686b6fcc93bb1d7e34b/`. Los resultados proceden del perfilador temporal que instrumentó en memoria el harness del commit `07706e6`. La extensión conservada en el repositorio reutiliza ese mismo fixture; su ejecución posterior de navegador se documenta a continuación con una baseline remota nueva. No se alteró código de producto para obtener estos resultados de perfilado.

## Comparación integrada contra el frontend remoto 1e55805

Esta comparación usa una **baseline nueva**, extraída con `git archive HEAD -- frontend` del commit remoto `1e5580596e89d0bac591a773210e99b220fd0dd0`. Conserva las funciones de mascota contextual y administración, incluidos `admin-command.mjs` y `mascota-scope.mjs`. El archivo ZIP contiene 93 archivos; el harness captura 90 archivos públicos y omite tres briefs TXT. Su manifiesto SHA-256 es `5101952c03dd3f9435859dbd99283f54164a654cbd81325f797ef0f604c50d5c`. No es el ZIP de 86 archivos utilizado en las comparaciones anteriores: **no se calculan cambios contra sus 5,82 s como si fuera la misma baseline**.

Se ejecutaron tres pares secuenciales acoplado/Pages, seis navegaciones en total, con todas las suites cerradas: Chrome 155.0.8059.86, Node 24.15.0, viewport 1440×1000, caché desactivada, contexto nuevo por muestra, 10 Mbps de descarga/5 Mbps de subida y 40 ms de latencia, sin limitar CPU. Ambas variantes comparten la misma API y SQLite temporal caliente. Se activaron diagnóstico CDP y `--direct-loopback`, sin traza; todos los orígenes permitidos eran listeners propios de loopback y los terceros quedaron bloqueados.

| Mediana de tres muestras | Remoto acoplado | Pages integrado |
| --- | ---: | ---: |
| TTFB del documento (`responseStart-requestStart`) | 2,7 ms | 2,8 ms |
| HTML recibido (`responseEnd`) | 62,8 ms | 61,1 ms |
| FCP | 664 ms | 640 ms |
| Último candidato LCP | 8.488 ms | 4.932 ms |
| Cuatro tarjetas disponibles | 1.514,2 ms | 1.430,9 ms |
| Estado del menú disponible | 1.399,1 ms | 1.346,7 ms |
| Bytes CDP observados, todos los orígenes permitidos | 10.855.974 | 6.872.395 |
| Solicitudes permitidas | 64 | 63 |

Las seis muestras mostraron cuatro tarjetas, cero errores de página, navegación o solicitudes y cero solicitudes pendientes. La fase de proxy del documento fue 0 ms en todas; no aparecieron tareas largas de más de 50 ms. El harness terminó con código 0 y cerró sus listeners, base temporal y Chrome; la comprobación posterior no encontró procesos `measure-pages` ni Chrome restantes.

El candidato LCP fue la fachada, con la misma superficie visible de 225.120 píxeles. La baseline solicita PNG (2.651.889 bytes CDP); el integrado solicita WebP (1.648.617 bytes). El waterfall también muestra que la portada integrada deja de precargar los atlas inactivos de Farmi y Boti. Son cambios combinados del frontend integrado: **esta medición no aísla su contribución individual ni atribuye toda la diferencia de LCP a separar el hosting**. No se modificó código de producto durante esta medición.

El [JSON completo saneado](pruebas/comparacion-remoto-pages-2026-10-21.json) conserva las seis muestras, waterfall, recursos, candidatos LCP, fuentes, manifiesto, hashes y comando. Sustituye la ruta absoluta del perfil del usuario por `%TEMP%`; no contiene cabeceras, cuerpos ni valores de query. Reproducción desde el clone integrado y con las suites cerradas, manteniendo aparte la extracción del commit remoto:

```powershell
$baseline=Join-Path $env:TEMP 'farmacia-remote-baseline-bb3232ae8ee24dc788c0a8e5aa95750a/frontend'
node scripts/measure-pages.cjs remoto-integrado-directo --baseline-root $baseline --active-samples 3 --scenarios active --profiles 10Mbps-40ms --diagnostics --direct-loopback
```

Son tres pares locales con API caliente, sin CDN, TLS ni tráfico real de Render/Cloudflare. No se repitieron los casos de API demorada o sin respuesta, ni se interpreta este LCP observado como un percentil de usuarios reales.
