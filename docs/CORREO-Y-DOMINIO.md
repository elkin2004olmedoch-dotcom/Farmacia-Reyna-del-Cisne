# Confirmación de correo y dominio propio

Integración de confirmación de correo y documentos de Farmacia Reina del Cisne. El proveedor elegido es **Brevo gratuito**, mediante API HTTPS. Resend se conserva como alternativa. La activación real requiere una cuenta Brevo activa, remitente verificado y credenciales privadas en Render; el código publicado por sí solo no acredita recepción de mensajes.

En producción, `CUSTOMER_REGISTRATION_REQUIRE_EMAIL` es `true` por defecto: si el envío está desactivado, el registro devuelve 503 sin crear una cuenta ni entregar JWT. Con el envío activo, las altas quedan pendientes hasta confirmar el enlace. Los administradores y repartidores existentes conservan sus accesos.

## Destinos que se conservan

| Componente | Destino documentado actual |
| --- | --- |
| Tienda en Cloudflare Pages | `https://farmacia-reyna-del-cisne-pruebas.pages.dev` |
| API Express en Render | `https://farmacia-reina-del-cisne.onrender.com` |
| Autenticación y datos | JWT, Node.js/Express y Prisma 6 existentes; PostgreSQL publicado y SQLite local |

La confirmación de correo se añade a esta autenticación y conserva los roles, el hash de contraseñas y los controles de autorización del backend. El dominio actual de Pages continúa disponible; un nombre `.com` sólo podrá anunciarse como activo después de adquirirlo, acreditar su control y verificar DNS y HTTPS. Esta guía no modifica alojamiento, planes, pagos ni facturación SRI.

## Activar Brevo gratuito

1. Crear la cuenta Free en [Brevo](https://onboarding.brevo.com/account/register) y completar la verificación y cualquier revisión de cuenta que solicite el proveedor.
2. En **Settings → Senders, Domains, IPs → Senders**, añadir **Farmacia Reina del Cisne** y verificar la dirección con el código recibido. [Remitentes oficiales](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email).
3. Generar una clave API en el panel privado. Guardar únicamente en Environment del backend existente: `BREVO_API_KEY`, `EMAIL_FROM` (sólo dirección) y `EMAIL_PUBLIC_ORIGIN=https://farmacia-reyna-del-cisne-pruebas.pages.dev`. Seleccionar `EMAIL_PROVIDER=brevo`. No publicar claves ni pegarlas en chats.
4. Mantener `EMAIL_VERIFICATION_ENABLED=false` hasta completar el remitente y las credenciales. Activar con `true` y desplegar manualmente una vez comprobada la configuración. Conservar `CUSTOMER_REGISTRATION_REQUIRE_EMAIL=true` y `SKIP_INITIAL_SEED=true`.
5. Probar con una dirección controlada: recibir el mensaje, abrir el enlace, confirmar explícitamente, comprobar que sólo funciona una vez e iniciar sesión. Después comprobar comprobante, factura autorizada y aviso de entrega. Una respuesta aceptada de Brevo no garantiza llegada a bandeja.

El plan Free publica **300 envíos al día**, compartidos por confirmaciones y documentos; no se contrató un plan de pago. [Cuotas Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan). Brevo puede sustituir el dominio del remitente gratuito por uno compatible con sus requisitos de entrega. El dominio propio sigue siendo una tarea separada. [Requisitos del remitente](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

La integración utiliza `POST https://api.brevo.com/v3/smtp/email`, adjuntos base64 y clave en cabecera privada, sin SDK ni SMTP. Render Free bloquea los puertos SMTP habituales; no se propone Gmail SMTP como solución en ese plan. [API Brevo](https://developers.brevo.com/reference/send-transac-email), [limitaciones Render](https://render.com/docs/free).

Se envía una clave UUID estable por contenido para la deduplicación de Brevo, cuya ventana documentada es **30 minutos**; Resend conserva su ventana de 24 horas. Una solicitud posterior puede reenviar el documento. No existe cola persistente ni garantía de reintento tras reinicio. [Idempotencia Brevo](https://developers.brevo.com/docs/heterogenous-versions-batch-emails). Brevo realiza seguimiento de aperturas y clics por defecto; la anonimización y disponibilidad de controles deben revisarse en la cuenta. No se promete que sus enlaces no sean reescritos. [Seguimiento transaccional](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails).

Las plantillas usan el logo, colores y enlaces de la farmacia. Verificación incluye botón y vencimiento exacto en hora de Ecuador; pedido y entrega muestran productos, imágenes disponibles e importes guardados. La factura autorizada conserva XML y representación imprimible. Las imágenes de productos proceden del catálogo actual; los importes proceden del snapshot del pedido.

## Elegir y registrar el nombre

Dos candidatos para que el propietario elija la escritura de su marca:

- `farmaciareinadelcisne.com`
- `farmaciareynadelcisne.com`

Son propuestas, no reservas. No se ha comprobado su disponibilidad, titularidad ni precio. El propietario deberá consultar el registrador, decidir si registra un nombre disponible y revisar el costo de registro y renovación antes de comprar. Un subdominio gratuito `pages.dev` no concede la propiedad del `.com`.

Para el envío se propone un subdominio del nombre adquirido, como `correo.<dominio-elegido>`, y un remitente con nombre reconocible: **Farmacia Reina del Cisne**. Resend recomienda separar el envío transaccional en un subdominio y verificar cada dominio de envío. La dirección exacta se define cuando exista un dominio bajo control del propietario. [Dominios verificados de Resend](https://resend.com/docs/dashboard/domains/introduction).

## Alternativa: preparar Resend desde cero

1. El propietario elige una dirección de correo bajo su control para administrar el registrador y la cuenta de Resend. Si todavía no tiene ninguna, debe crearla primero. La cuenta no se abre automáticamente desde este proyecto.
2. Tras registrar el dominio, añade el subdominio de envío en **Resend → Domains → Add Domain**. Configura la región y copia los registros que muestre **Records** para SPF y DKIM. Sus nombres, tipos y valores deben coincidir con los generados por Resend; los CNAME de correo deben permanecer **DNS only**, sin proxy. Tras la verificación, revisa DMARC y deja desactivado el seguimiento de enlaces para los mensajes de confirmación. [Alta y verificación oficial](https://resend.com/docs/add-a-domain), [configuración de dominios transaccionales](https://resend.com/docs/dashboard/domains/introduction).
3. No copies una receta antigua de DNS: para dominios creados después de agosto de 2026, Resend puede generar CNAME de envío en lugar del par MX/TXT anterior. Si solicita un MX para el Return-Path, usa el subdominio indicado; no sustituyas los MX del dominio raíz destinados a otro buzón. [Registros y conflictos MX](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records).
4. Espera a que el dominio figure como verificado. El botón del panel inicia la comprobación; también existe `POST /domains/:domain_id/verify`, cuyo proceso es asíncrono. Una solicitud aceptada todavía no equivale a DNS verificado. No se ha ejecutado esa API aquí. [API de verificación de Resend](https://resend.com/docs/api-reference/domains/verify-domain).
5. Crea una clave de API con permiso de envío y restricción al dominio elegido. Consérvala únicamente como secreto del servidor. Resend permite limitar permisos y dominio de cada clave. [Gestión de claves](https://resend.com/docs/dashboard/api-keys/introduction).

El dominio de prueba `resend.dev` sólo permite enviar al correo asociado con la cuenta de Resend. No permite confirmar los correos de todos los clientes. Para otros destinatarios se necesita un dominio propio verificado y un `from` de ese dominio. La dirección actual de Pages se conserva para la web; no se utiliza como remitente de los clientes. [Restricción oficial de resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

El backend integra la API HTTPS `POST https://api.resend.com/emails`, con autenticación Bearer y los campos `from`, `to`, `subject`, `html` y `text`. La integración mantiene Node.js/Express y usa `fetch` nativo, sin añadir un SDK para este envío. La clave no debe llegar al frontend. [API oficial de envío](https://resend.com/docs/api-reference/emails/send-email).

### Cuotas gratuitas verificadas

Resend publica actualmente **3.000 correos transaccionales al mes**, un máximo de **100 al día** y hasta **3 dominios verificados** en Free. El día se reinicia a medianoche UTC. Los envíos y las recepciones cuentan para la cuota; varios destinatarios consumen unidades separadas. Los reenvíos de confirmación deben respetar esos límites. Estas condiciones pueden cambiar y deben revisarse al crear la cuenta; no se ha contratado un plan. [Cuotas oficiales](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [planes actuales](https://resend.com/pricing).

## Configurar el servidor existente en Render

Los nombres aceptados por esta integración son:

| Variable | Preparación y condición |
| --- | --- |
| `EMAIL_VERIFICATION_ENABLED` | Mantener `false` mientras falten cuenta, clave, remitente verificado o validación completa. Cambiar a `true` sólo al activar el flujo preparado. |
| `CUSTOMER_REGISTRATION_REQUIRE_EMAIL` | `true` en producción: impide crear cuentas o usar clientes sin confirmar, incluso si una copia antigua conserva el indicador opcional. No afecta al personal. |
| `EMAIL_PROVIDER` | `brevo` para el proveedor elegido; `resend` sólo para la alternativa configurada. |
| `BREVO_API_KEY` | Clave privada de Brevo, únicamente en Environment del backend. |
| `EMAIL_PUBLIC_ORIGIN` | Origen HTTPS exacto de la tienda, incluido en la allowlist CORS. Inicialmente puede ser el origen actual de Pages; sin ruta ni fragmento. |
| `RESEND_API_KEY` | Clave privada de envío de Resend. Se introduce en el servicio Render, no en Git, Pages, capturas, logs ni chats. |
| `EMAIL_FROM` | Sólo la dirección verificada por el proveedor, sin nombre ni cabeceras. El servidor añade el nombre **Farmacia Reina del Cisne**. Brevo permite verificar un buzón; Resend exige dominio propio para destinatarios externos. |

El propietario puede configurarlas en **Render → servicio farmacia-reina-del-cisne → Environment**. **Save only** guarda sin aplicar hasta el siguiente despliegue; las opciones de guardar y desplegar sí actualizan el servicio. La activación debe coordinarse con el despliegue manual existente, sin recrear el servicio ni ejecutar un seed. [Variables y secretos en Render](https://render.com/docs/configure-environment-variables).

La base de confirmación se publicó mediante la [PR #17](https://github.com/elkin2004olmedoch-dotcom/Farmacia-Reyna-del-Cisne/pull/17), con la migración aditiva aplicada en PostgreSQL. Se verificó el respaldo antes de aquel despliegue. Se conserva el servicio Render gratuito y `SKIP_INITIAL_SEED=true`. El envío real debe permanecer desactivado hasta comprobar la cuenta, el remitente y las credenciales del proveedor elegido.

## Contrato de confirmación

El enlace de correo utiliza la ruta pública de la tienda y un token opaco aleatorio, de un solo uso y válido durante **una hora**:

```text
https://farmacia-reyna-del-cisne-pruebas.pages.dev/confirmar-correo#token=TOKEN_OPACO
```

`TOKEN_OPACO` es un marcador documental. El enlace no lleva un JWT de sesión. La página lee el fragmento y confirma mediante un POST a la API; visitar la ruta por GET no confirma una cuenta. El token no se debe registrar ni publicar. Su comprobación y consumo corresponden al servidor.

Tras **Confirmar y entrar**, el POST consume el enlace y entrega una sesión web únicamente para un cliente activo y verificado. La pantalla guarda esa sesión mediante el mecanismo JWT existente y redirige al catálogo. Una respuesta tardía de un enlace anterior no sustituye la sesión. El JWT no se coloca en URL, historial ni correo; las respuestas de la API usan `Cache-Control: no-store`. Confirmar un correo de administrador o repartidor no inicia sesión automáticamente para esos roles.

| Endpoint de la API | Cuerpo y función |
| --- | --- |
| `POST /api/auth/verify-email` | `{token}`: valida caducidad y uso único y confirma el correo. |
| `POST /api/auth/resend-verification` | `{email}`: solicita otro mensaje conforme a los límites del backend. |

Con el flujo habilitado, las nuevas altas quedan pendientes y no reciben un JWT hasta confirmar. El middleware impide usar una cuenta pendiente en operaciones autenticadas. `Usuario.emailVerifiedAt` sigue siendo nullable y la migración histórica conserva `emailVerificationRequired=false`; la política obligatoria de producción exige igualmente confirmar a todos los clientes sin fecha de verificación. Un reenvío actualiza ese indicador de forma transaccional, sin atribuir una confirmación inexistente. Administradores y repartidores conservan sus accesos.

## Asociar el `.com` a Cloudflare Pages

Sólo después de registrar el dominio y confirmar el acceso del propietario:

1. En el proyecto existente **farmacia-reyna-del-cisne-pruebas**, abre **Custom domains → Set up a domain** y asocia el nombre antes de configurar su CNAME.
2. Para el dominio raíz `.com`, Cloudflare exige una zona en la misma cuenta de Pages y sus nameservers. Un subdominio, como `www`, puede utilizar CNAME hacia `farmacia-reyna-del-cisne-pruebas.pages.dev` sin trasladar toda la zona. No cambies nameservers hasta acreditar la propiedad y revisar los registros existentes. [Dominios de Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/).
3. Comprueba DNS y certificado activo antes de distribuir la nueva dirección. Cloudflare gestiona la emisión y renovación de certificados; si hay restricciones CAA, revisa que permitan la autoridad necesaria. No se promete una hora de activación. [Certificados de Cloudflare](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/enable-universal-ssl/), [CAA en Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/#caa-records).

No se retira el origen actual de Pages durante esta preparación.

### Orígenes y retornos tras verificar el nuevo dominio

- Añadir el nuevo origen HTTPS a `CORS_ORIGIN` mediante la allowlist exacta existente. No usar `*`, sufijos abiertos ni una URL de vista previa como origen permanente.
- Actualizar `EMAIL_PUBLIC_ORIGIN` al dominio canónico verificado. Los enlaces posteriores utilizarán `/confirmar-correo#token=…` en ese origen.
- Revisar `PAYMENT_PUBLIC_ORIGIN`, el dominio WEB autorizado en PayPhone y sus retornos antes de una futura habilitación comercial. `PAYMENT_API_ORIGIN` debe seguir apuntando a la API real que recibe `/api/pagos/payphone/respuesta`; cambiar sólo la web en Pages no mueve ese endpoint. [Configuración de pagos del proyecto](PAGOS-Y-PAYPHONE.md).
- Si se desea un callback bajo el dominio propio, primero hay que asociar un subdominio de API al servicio Render existente, configurar su DNS y verificar HTTPS. Sólo entonces se podrá cambiar `PAYMENT_API_ORIGIN` y revisar el origen de API/CSP del frontend. Es una tarea futura, no un cambio aplicado aquí. [Dominios personalizados de Render](https://render.com/docs/custom-domains).

## Acciones pendientes del propietario

1. Completar la cuenta Brevo gratuita y verificar el remitente bajo su control.
2. Guardar la clave y el remitente de forma privada en Render con el origen HTTPS exacto y `EMAIL_PROVIDER=brevo`.
3. Activar el flujo con las credenciales comprobadas y verificar el envío a una dirección controlada. Comprobar recepción, caducidad, reutilización, reenvío, límites y bloqueo de cuentas pendientes; no usar datos comerciales.
4. Si falta algún requisito, mantener `EMAIL_VERIFICATION_ENABLED=false` y la obligación de confirmar activa: el registro queda temporalmente indisponible.
5. Para el `.com`, elegir la escritura Reina/Reyna, decidir su registro y renovación y acreditar acceso DNS. Esta compra es independiente de Brevo y no se ha realizado.

Las comprobaciones locales y la consulta de documentación no acreditan entrega de correo, dominio adquirido, DNS propagado ni certificado emitido. Registrar o verificar un dominio tampoco activa PayPhone, SRI u otros servicios comerciales.

## Comprobantes y facturas por correo

La configuración de Brevo o Resend habilita los documentos transaccionales. Tras guardar un pedido nuevo, el servidor solicita el envío de su comprobante al **correo verificado de la cuenta**, nunca al destinatario que se escriba en el pedido. Los pedidos repetidos con la misma clave no disparan otro envío automático. El comprobante reutiliza la vista de la web, incluye los importes y la tarifa de envío guardados y se adjunta como HTML imprimible; se puede abrir e imprimir como PDF. Conserva la indicación de que no tiene validez tributaria ni acredita un pago.

Cuando el flujo SRI existente devuelve una factura `AUTORIZADA`, se solicita además el envío de su XML y su representación imprimible HTML al propietario verificado. Se conserva el ambiente de pruebas o producción de los documentos. Esta función no crea una factura por sí sola, no activa SRI ni cambia el estado de pago.

En **Mis pedidos → Ver comprobante → Enviar a mi correo** se puede volver a solicitar el documento; si ya hay una factura autorizada, se envía esa factura. `POST /api/pedidos/:id/correo` requiere autenticación y propiedad del pedido, no permite sustituir el destinatario y limita las solicitudes a cinco por hora por IP. Los correos no verificados no reciben documentos. Las cuentas anteriores necesitarán completar una verificación antes de usar esta función cuando se active el envío.

La respuesta distingue `disabled`, `verification_required`, `accepted` y `unavailable`. `accepted` significa aceptación del proveedor, no entrega en bandeja. Los fallos no revierten el pedido o la factura; se pueden reintentar con el botón. No existe una cola persistente ni reintento automático tras un reinicio. Se usa una clave de idempotencia por contenido y destinatario; Resend deduplica durante 24 horas. Fuera de esa ventana, una nueva solicitud puede reenviar el mismo documento. [Idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys), [formatos de adjuntos admitidos](https://resend.com/docs/knowledge-base/what-attachment-types-are-not-supported).

Las confirmaciones y los documentos comparten las cuotas del plan. El plan Free permite empezar sin una suscripción de correo, dentro de sus límites. El dominio `.com` requiere registro y renovación; no se ha comprobado una promoción o beneficio particular para esta farmacia. Mantener Pages no exige comprar un dominio. [Registro de dominios en Cloudflare](https://domains.cloudflare.com/), [cuotas Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

## Migración y restauración

Aplica las migraciones aditivas y genera el cliente Prisma 6 antes de arrancar el backend nuevo. El despliegue existente en Render ejecuta esa preparación; mantén `SKIP_INITIAL_SEED=true` para conservar los datos. En SQLite local, trabaja sobre una copia respaldada y revisa el destino antes de ejecutar `db:migrate`. No ejecutes el setup de una instalación nueva sobre una base comercial.

La migración y la restauración conservan el estado de verificación del usuario, pero no copian ni reactivan enlaces de confirmación. Las cuentas pendientes deben solicitar un enlace nuevo.
