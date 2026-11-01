# Reparto móvil para Android y iPhone

## Requisito confirmado

El propietario pidió seguimiento tipo Uber Eats y confirmó Android e iPhone y una app instalable para repartidores. La continuidad se necesita **durante entregas activas**, al abrir Google Maps o bloquear la pantalla. Al entregar, cancelar, retirar permiso o cerrar sesión se deja de compartir. No se promete posición con el equipo apagado, sin señal, sin permiso, tras cierre forzado o bajo restricciones del sistema operativo.

La tienda, la identidad, la API Express y Prisma 6 se conservan. El Reto 3 y la selección de Angular/React/Vue están expresamente aplazados.

## Decisión de implementación

Aplicación complementaria `mobile/`, HTML/CSS/JavaScript y Capacitor 8.6.0. Se reutiliza la API de entregas y el logo. Ubicación nativa: `@capacitor-community/background-geolocation` 1.3.1; HTTP nativo de Capacitor; credenciales en Keychain/Keystore mediante `@aparajita/capacitor-secure-storage` 8.0.1. Notificaciones locales 8.3.1 permiten solicitar el permiso de notificación Android. Esbuild 0.28.2 empaqueta estos imports para el contenedor; no sustituye el frontend web.

Estas dependencias MIT se justifican por capacidades que el navegador no ofrece: servicio de ubicación, solicitudes HTTP no suspendidas con la WebView, y almacenamiento cifrado. No se añade un framework del Reto 3.

La web/PWA permanece útil para consulta y GPS en primer plano. Una app con solo una WebView remota no resuelve la captura continua. La app propuesta usa contenido local, CSP restrictiva, permisos explícitos, `android.useLegacyBridge=true`, notificación persistente y `UIBackgroundModes=location` en iOS. Los tokens no se guardan en localStorage ni se incluyen en URL, logs o documentos.

## Sesión móvil y contrato HTTP

Rutas nuevas privadas/de autenticación bajo `/api/auth/mobile`:

- `POST /login`: `{email,password}`. Solo usuario activo `repartidor`. Devuelve `{usuario,token,refreshToken,expiresAt,refreshExpiresAt}`. JWT HS256/issuer/audience existentes, claim adicional `mobileSession` y acceso de 15 minutos.
- `POST /renew`: `{refreshToken,nextSecret}`. Refresh con formato `<uuid>.<secreto-base64url-43-caracteres>`; `nextSecret` es un nuevo valor aleatorio de 32 bytes. Devuelve la misma forma de sesión. Refresh expira absolutamente en 30 días.
- `POST /logout`: Bearer móvil; revoca esa sesión, retira su ubicación/propiedad de seguimiento. Una sesión revocada deja de autorizar inmediatamente.

Tabla aditiva `SesionMovil`: UUID, usuario, versión de token de usuario al crear, hashes SHA-256 del secreto actual y anterior, expiración absoluta, revocación y fechas. Nunca se guarda el secreto en claro. Rotación serializable con actualización condicional. Repetir el secreto anterior con **el mismo nextSecret cuyo hash ya es el actual** es idempotente: resuelve la pérdida de la respuesta sin ampliar expiración. Reutilizar el anterior con otro secreto revoca la sesión. Se valida usuario activo, rol y tokenVersion en renovación y uso. Los tokens web y sus tiempos actuales se conservan.

La app guarda `{refreshToken,pendingNextSecret}` cifrados antes de renovar, serializa la renovación y reintenta exactamente el mismo par si se pierde la respuesta. El acceso JWT se conserva en memoria y se obtiene de nuevo al restaurar. La contraseña solo vive en el formulario hasta el inicio de sesión.

## Propiedad del seguimiento

`Entrega.sesionSeguimientoId` nullable referencia la sesión móvil. Evita que una pestaña web antigua retire una ubicación publicada por la app.

- `POST /entregas/:id/seguimiento-movil`: Bearer móvil del repartidor asignado, entrega en camino/en destino. Reclama la entrega para esa sesión y devuelve DTO actual. Una sesión no puede mantener dos seguimientos simultáneos. Una sesión distinta activa provoca 409; no se roba silenciosamente el seguimiento.
- `DELETE /entregas/:id/seguimiento-movil`: solo sesión propietaria, retiro condicional de posición y propiedad. Repetición propia ya retirada es idempotente.
- PUT de ubicación existente: si existe propietario móvil, solo su JWT publica; si JWT móvil, debe haber reclamado previamente. GPS web continúa funcionando cuando no hay propietario móvil.
- DELETE de ubicación web no elimina una muestra de un propietario móvil. Cierre/cancelación, revocación y desactivación retiran la propiedad y las coordenadas en transacción.
- DTO operativo añade `origenSeguimiento: 'app' | 'web' | null`; nunca revela sesión/secreto al comprador.
- `GET /entregas/:id`: admin o repartidor propio; devuelve el mismo DTO privado que el listado, para reconciliar una sola entrega sin recorrer páginas. Ajeno devuelve 404.

SQLite y PostgreSQL reciben migraciones aditivas equivalentes. No se eliminan tablas, columnas, datos ni historiales. Los índices se limitan al usuario y expiración de sesiones y a la propiedad que se consulta para una entrega activa.

## App y recuperación

Una pantalla de acceso y bandeja privada, con actualización, salida/llegada/finalización, compartir/detener, destino Google Maps y llamada al llegar. Los clientes/administradores no acceden a la app de reparto. Interfaz vino/crema con etiquetas, teclado, focos, estados claros y controles táctiles.

Al iniciar GPS: comprobar soporte nativo y notificaciones, reclamar seguimiento y agregar observador con mensaje persistente, `stale:false`, `distanceFilter:0`. Validar coordenada, precisión y hora. Un solo PUT pendiente y límite mínimo de 12 segundos (servidor actual: 10 segundos). Se mantiene solo la muestra más reciente pendiente, no una ruta histórica.

Si falta red se conserva la última muestra en memoria. Al volver, se obtiene estado/versiones y se envía solo una muestra de menos de dos minutos; un 409 de versión se reconcilia con el DTO antes de otro intento. No se reenvían puntos viejos como posición actual. La notificación y el panel muestran captura, envío, sin señal/red, pausa y sesión vencida. No se inventa ETA ni movimiento.

No detener GPS por `pagehide` del contenedor: el servicio nativo es responsable. En primer plano se reconcilia la entrega y se detiene si fue cerrada. En cada captura se comprueba el estado vigente, por lo que una cancelación administrativa cierra el emisor al contactar. Reabrir tras cierre forzado exige verificación y consentimiento para reanudar; no se promete reinicio invisible.

### Interfaces entre módulos móviles

- `createSession({transport,storage,randomBytes,now=Date.now})` devuelve `login(email,password)`, `restore()`, `request(path,{method='GET',data}={})`, `logout()`, getters `user` y `authenticated`. `request` devuelve el `data` del envelope y lanza error con `status`/`code` al fallar. `login`/`restore` devuelven perfil seguro; `restore` sin sesión devuelve null. Los errores no incluyen secretos.
- `transport(path,{method='GET',data,token}={})` devuelve `{status,body}`; ruta relativa empieza con `/`, sin prefijo `/api`. `storage` ofrece `get(key)`, `set(key,value)` y `remove(key)` asíncronos. `randomBytes(n)` devuelve Uint8Array; próximo secreto base64url sin relleno de 32 bytes.
- Clave cifrada `farmacia.reparto.session.v1`: `{refreshToken,pendingNextSecret,usuario,refreshExpiresAt,pendingRevocation?}`. JWT solo en memoria. Antes de cualquier petición renovar si falta JWT o caduca en menos de 60 s; un 401 permite una renovación/reintento único. Fallo autenticado definitivo retira almacenamiento. Falta de red conserva el par para reintento, no revoca sesión local. Logout sin red marca `pendingRevocation:true` cifrado y limpia inmediatamente el perfil/JWT en memoria: restore y el próximo login reintentan solo la revocación, sin volver a mostrar el perfil previo. No se crea nueva sesión hasta confirmar la retirada o que la anterior ya sea inválida.
- `createTracker({session,gps,clock={now:Date.now,setTimeout,clearTimeout},onStatus})` devuelve `start(delivery)`, `stop()`, `reconcile()` y getter `state`. `state` al menos `{activeId,phase,lastCapturedAt,lastSentAt,precision}`. `onStatus` recibe snapshot y `message` en español; fases `idle`, `starting`, `sharing`, `offline`, `stale`, `permission-denied`, `closed`, `error`, `reconnecting`.
- `gps.addWatcher(options,callback)` y `gps.removeWatcher({id})` mantienen el contrato del plugin. La muestra tiene `latitude`, `longitude`, `accuracy`, `time`; error puede incluir `code:'NOT_AUTHORIZED'`. `start` reclama primero la sesión, registra watcher, y `stop` retira watcher, espera PUT pendiente y retira propiedad. El cierre y los permisos perdidos detienen el emisor.
- Adaptador `mobile/src/native.js` exporta `createNativeRuntime()` que falla explícitamente fuera de Android/iOS; devuelve `{transport,storage,randomBytes,gps,ensureNotifications,openSettings}`. Su transporte fija el origen público verificado de Render; ningún host lo aporta un formulario o un enlace. La UI puede recibir runtime sustituido en pruebas, nunca usa almacenamiento web como fallback nativo.

El seguimiento web conserva la consulta privada cada cinco segundos y el mapa voluntario existente. Una posición sin actualización sigue caducando a los dos minutos; nunca se finge ubicación en vivo.

## Verificación y operación

Pruebas Node con SQLite temporal y PostgreSQL temporal para sesiones, rotación, respuesta perdida, reuso, revocación, permisos/propiedad, concurrencia y cierre. Pruebas del motor móvil con reloj, transporte, almacenamiento y proveedor nativo sustituidos explícitamente. Pruebas UI de teclado, móvil, errores y navegación usando datos sintéticos.

Generar proyectos Android/iOS y compilar Android si el SDK local lo permite. La firma de distribución, compilación iOS (macOS/Xcode), instalación y pruebas en **Android e iPhone físicos** son puertas de entrega: pantalla bloqueada al menos 30 minutos, Google Maps en primer plano, pérdida/recuperación de red, más de una vida del JWT, reinicio y finalización. Una simulación o build no demuestra continuidad física.

El manifiesto actual declara Render Free: ese plan puede suspenderse tras inactividad. La operación comercial 24/7 requiere revisar el plan realmente contratado y una instancia sin suspensión. No se contratan planes ni servicios de pago automáticamente. No se garantiza disponibilidad absoluta ni frecuencia exacta del sensor.

Fuentes verificadas el 1 de noviembre de 2026: [plugin GPS](https://github.com/capacitor-community/background-geolocation), [HTTP nativo](https://capacitorjs.com/docs/apis/http), [almacenamiento cifrado](https://github.com/aparajita/capacitor-secure-storage), [Android ubicación](https://developer.android.com/develop/sensors-and-location/location/background), [Apple ubicación](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background), [Render Free](https://render.com/docs/free).
