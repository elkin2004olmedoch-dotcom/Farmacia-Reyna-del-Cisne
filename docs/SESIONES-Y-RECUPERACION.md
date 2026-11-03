# Sesiones web y recuperación de cuenta

La farmacia conserva HTML, CSS, JavaScript, Express y Prisma 6. Se tomaron como referencia los conceptos de sesión y recuperación del [repositorio PLIEGO](https://github.com/andres18113/pliego-muejeje/tree/5cf793002754fcdbff483743ce3d6dd6cfee3326), con implementación propia. La revisión de ese repositorio fue estática; no acredita la seguridad de su servicio publicado.

## Sesión web

- La web usa cookies host-only `__Host-farmacia-access` y `__Host-farmacia-refresh`, con `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/`. En HTTP local se usan nombres sin prefijo y sin Secure para permitir las pruebas.
- El JWT de acceso dura 15 minutos. Incluye el identificador de sesión, versión del usuario, emisor y audiencia. Cada petición privada comprueba además la sesión persistida, su vencimiento, revocación, usuario activo, rol y verificación de correo.
- La renovación contiene un secreto aleatorio de 32 bytes. La base guarda su SHA-256. Caduca a los 30 días desde el inicio de sesión, sin prolongación ilimitada.
- La renovación rota el secreto en una transacción Serializable. El secreto anterior permite reintentar una respuesta perdida durante cinco minutos; devuelve la misma rotación mediante HMAC con propósito propio. Se limita a diez sesiones activas por cuenta.
- El frontend conserva el perfil en memoria. No escribe JWT en sessionStorage ni localStorage. Una sesión anterior se canjea una vez por cookies y se retira del almacenamiento.
- Cerrar sesión incrementa la versión y revoca sesiones web y móviles. Si falla la conexión, la interfaz permite reintentar y no afirma que se cerró la sesión.
- Las solicitudes web que cambian datos requieren `X-Farmacia-Web: 1` y un `Origin` exacto autorizado. Las cookies Strict complementan esta defensa CSRF. Un encabezado Bearer inválido no se sustituye silenciosamente por una cookie válida.
- La API de clientes nativos mantiene sus credenciales Bearer y su renovación móvil. Los permisos se comprueban en el backend.

## Mismo origen en Cloudflare Pages

El cliente solicita `/api/*` en su dominio. El build agrega un Worker con destino fijo al backend existente de Render. Permite conservar cookies propias incluso cuando el navegador bloquea cookies de terceros.

El proxy rechaza orígenes ajenos y redirecciones del backend; transmite sólo encabezados permitidos y las cookies de la farmacia. No acepta un destino proporcionado por el visitante ni confía en encabezados IP enviados por él. Las respuestas de la API usan `Cache-Control: no-store`. El Worker no contiene credenciales. Las fotos subidas conservan su origen público independiente.

La implementación sigue el [modo avanzado de Pages](https://developers.cloudflare.com/pages/functions/advanced-mode/). Sólo `/api/*` invoca la función. Se mantiene el proyecto actual y su plan; las cuotas gratuitas y el arranque en frío de Render siguen siendo límites operativos.

## Recuperar contraseña

En **Mi cuenta → ¿Olvidaste tu contraseña?** se solicita un correo. La respuesta es genérica para cuentas existentes o inexistentes. Se aplican cinco solicitudes por hora por IP, un minuto entre envíos de una misma cuenta y el límite de intentos del cambio de contraseña.

El mensaje usa el remitente Brevo ya configurado y la identidad de la farmacia. El enlace lleva un secreto aleatorio en el fragmento de `/recuperar-cuenta#token=…`. El navegador retira el fragmento al abrir la pantalla. Abrir el enlace no cambia la contraseña: se debe enviar el formulario.

Sólo se guarda el hash del secreto. Vence a los 30 minutos y se consume una vez, dentro de la misma transacción que guarda bcrypt coste 12, incrementa la versión y revoca sesiones anteriores. No cambia el rol ni confirma automáticamente un correo pendiente. La contraseña exige al menos diez caracteres, letra y número y máximo 72 bytes.

El envío usa las variables privadas existentes del proveedor. Las pruebas automatizadas simulan el envío; no mandan correos a clientes. La aceptación de Brevo no prueba la llegada a la bandeja del destinatario.

## Persistencia y comprobación

La migración `202611030012_web_sessions` agrega dos tablas en SQLite y PostgreSQL:

| Tabla | Necesidad e índices |
| --- | --- |
| SesionWeb | Revocación y rotación persistentes. Clave primaria para autenticar; índices usuario/creación para limitar sesiones y usuario/vencimiento para retirar expiradas. |
| PasswordReset | Un enlace vigente por usuario y búsqueda por hash único. Caducidad, propiedad y consumo atómico. |

No altera ni elimina tablas de negocio. Las relaciones usan Restrict; hashes, vencimientos y pares de rotación tienen restricciones SQL. En PostgreSQL se activa RLS y se retiran privilegios de PUBLIC, anon y authenticated. Las tablas se usan desde el servidor, nunca desde el navegador. La herramienta de traslado entre entornos descarta enlaces de recuperación y sesiones web.

Pruebas disponibles: `web-session.test.cjs`, `password-reset.test.cjs`, `pages-proxy.test.cjs`, `api-client.test.cjs`, `web-session.spec.cjs` y el recorrido separado de Pages. Se ejecutan con bases temporales y datos sintéticos. La aplicación mantiene también límites de intentos, CORS restrictivo, autorización de propietario/rol, validación, CSP y revocación por versión.

Este cambio no constituye una certificación ni una garantía de ausencia de vulnerabilidades. La firma de iPhone, las pruebas de GPS con teléfonos físicos, los cobros comerciales y la disponibilidad continua siguen necesitando sus comprobaciones específicas.

## Resultado de verificación — 3 de noviembre de 2026

- Suite Node completa: 397 aprobadas, cero fallidas y una integración PostgreSQL opcional omitida. Esa integración general requiere su activación independiente.
- Pruebas específicas de sesiones y recuperación en PostgreSQL 18 temporal: 4/4, con migraciones, restricciones de hashes, RLS y privilegios PUBLIC.
- Sesión, perfil y mapa automático en escritorio/móvil: 18/18. Distribución de Pages con proxy, cookies, compra, imágenes y documentos: 24/24.
- Lote de recorridos funcionales: 57 aprobados y un fallo inicial en el fixture de acceso de una prueba de cancelación. Se adaptó ese fixture al canje de cookies; su reejecución dirigida terminó 2/2 en escritorio y móvil. Incluye confirmaciones de las mascotas, cambio de precio/promoción visible para clientes, tarifa, reparto y pagos de práctica.
- Análisis de sintaxis de 42 archivos modificados y `git diff --check`: aprobados. Auditorías de dependencias de producción de raíz y móvil: cero avisos publicados en la consulta; las versiones npm no cambiaron.
- La actualización de mapa 0.3.0 conserva su APK verificado por SHA-256 y firma Android de depuración. Sincronización iOS realizada en Windows; sin firma ni prueba física.
- Respaldo privado PostgreSQL previo a la migración, con listado de archivo validado. Las pruebas no enviaron correos reales ni escribieron registros comerciales en producción.
