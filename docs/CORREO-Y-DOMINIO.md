# Confirmación de correo y dominio propio

Preparación para Farmacia Reina del Cisne. Fuentes oficiales consultadas el **2 de noviembre de 2026**. El propietario todavía no dispone del dominio ni de la cuenta de envío. No se han comprado dominios, creado cuentas, configurado credenciales, cambiado DNS ni enviado mensajes en esta preparación. `EMAIL_VERIFICATION_ENABLED=false` mantiene desactivado el envío y la exigencia de confirmar las nuevas altas hasta completar la configuración.

## Destinos que se conservan

| Componente | Destino documentado actual |
| --- | --- |
| Tienda en Cloudflare Pages | `https://farmacia-reyna-del-cisne-pruebas.pages.dev` |
| API Express en Render | `https://farmacia-reina-del-cisne.onrender.com` |
| Autenticación y datos | JWT, Node.js/Express y Prisma 6 existentes; PostgreSQL publicado y SQLite local |

La confirmación de correo se añade a esta autenticación y conserva los roles, el hash de contraseñas y los controles de autorización del backend. El dominio actual de Pages continúa disponible; un nombre `.com` sólo podrá anunciarse como activo después de adquirirlo, acreditar su control y verificar DNS y HTTPS. Esta guía no modifica alojamiento, planes, pagos ni facturación SRI.

## Elegir y registrar el nombre

Dos candidatos para que el propietario elija la escritura de su marca:

- `farmaciareinadelcisne.com`
- `farmaciareynadelcisne.com`

Son propuestas, no reservas. No se ha comprobado su disponibilidad, titularidad ni precio. El propietario deberá consultar el registrador, decidir si registra un nombre disponible y revisar el costo de registro y renovación antes de comprar. Un subdominio gratuito `pages.dev` no concede la propiedad del `.com`.

Para el envío se propone un subdominio del nombre adquirido, como `correo.<dominio-elegido>`, y un remitente con nombre reconocible: **Farmacia Reina del Cisne**. Resend recomienda separar el envío transaccional en un subdominio y verificar cada dominio de envío. La dirección exacta se define cuando exista un dominio bajo control del propietario. [Dominios verificados de Resend](https://resend.com/docs/dashboard/domains/introduction).

## Preparar Resend desde cero

1. El propietario elige una dirección de correo bajo su control para administrar el registrador y la cuenta de Resend. Si todavía no tiene ninguna, debe crearla primero. La cuenta no se abre automáticamente desde este proyecto.
2. Tras registrar el dominio, añade el subdominio de envío en **Resend → Domains → Add Domain**. Configura la región y copia los registros que muestre **Records** para SPF y DKIM. Sus nombres, tipos y valores deben coincidir con los generados por Resend; los CNAME de correo deben permanecer **DNS only**, sin proxy. Tras la verificación, revisa DMARC y deja desactivado el seguimiento de enlaces para los mensajes de confirmación. [Alta y verificación oficial](https://resend.com/docs/add-a-domain), [configuración de dominios transaccionales](https://resend.com/docs/dashboard/domains/introduction).
3. No copies una receta antigua de DNS: para dominios creados después de agosto de 2026, Resend puede generar CNAME de envío en lugar del par MX/TXT anterior. Si solicita un MX para el Return-Path, usa el subdominio indicado; no sustituyas los MX del dominio raíz destinados a otro buzón. [Registros y conflictos MX](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records).
4. Espera a que el dominio figure como verificado. El botón del panel inicia la comprobación; también existe `POST /domains/:domain_id/verify`, cuyo proceso es asíncrono. Una solicitud aceptada todavía no equivale a DNS verificado. No se ha ejecutado esa API aquí. [API de verificación de Resend](https://resend.com/docs/api-reference/domains/verify-domain).
5. Crea una clave de API con permiso de envío y restricción al dominio elegido. Consérvala únicamente como secreto del servidor. Resend permite limitar permisos y dominio de cada clave. [Gestión de claves](https://resend.com/docs/dashboard/api-keys/introduction).

El dominio de prueba `resend.dev` sólo permite enviar al correo asociado con la cuenta de Resend. No permite confirmar los correos de todos los clientes. Para otros destinatarios se necesita un dominio propio verificado y un `from` de ese dominio. La dirección actual de Pages se conserva para la web; no se utiliza como remitente de los clientes. [Restricción oficial de resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

El backend puede usar la API HTTPS `POST https://api.resend.com/emails`, con autenticación Bearer y los campos `from`, `to`, `subject`, `html` y/o `text`. La integración mantiene Node.js/Express y puede usar `fetch` nativo; no necesita añadir un SDK para este envío. La clave no debe llegar al frontend. [API oficial de envío](https://resend.com/docs/api-reference/emails/send-email).

### Cuotas gratuitas verificadas

Resend publica actualmente **3.000 correos transaccionales al mes**, un máximo de **100 al día** y hasta **3 dominios verificados** en Free. El día se reinicia a medianoche UTC. Los envíos y las recepciones cuentan para la cuota; varios destinatarios consumen unidades separadas. Los reenvíos de confirmación deben respetar esos límites. Estas condiciones pueden cambiar y deben revisarse al crear la cuenta; no se ha contratado un plan. [Cuotas oficiales](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [planes actuales](https://resend.com/pricing).

## Configurar el servidor existente en Render

Los nombres aceptados por esta integración son:

| Variable | Preparación y condición |
| --- | --- |
| `EMAIL_VERIFICATION_ENABLED` | Mantener `false` mientras falten cuenta, clave, remitente verificado o validación completa. Cambiar a `true` sólo al activar el flujo preparado. |
| `EMAIL_PUBLIC_ORIGIN` | Origen HTTPS exacto de la tienda, incluido en la allowlist CORS. Inicialmente puede ser el origen actual de Pages; sin ruta ni fragmento. |
| `RESEND_API_KEY` | Clave privada de envío de Resend. Se introduce en el servicio Render, no en Git, Pages, capturas, logs ni chats. |
| `EMAIL_FROM` | Nombre de la farmacia y dirección perteneciente al dominio verificado. No se rellena con una dirección inventada mientras el dominio no exista. |

El propietario puede configurarlas en **Render → servicio farmacia-reina-del-cisne → Environment**. **Save only** guarda sin aplicar hasta el siguiente despliegue; las opciones de guardar y desplegar sí actualizan el servicio. La activación debe coordinarse con el despliegue manual existente, sin recrear el servicio ni ejecutar un seed. No se han inspeccionado ni cambiado sus valores privados. [Variables y secretos en Render](https://render.com/docs/configure-environment-variables).

En esta sesión no hay herramientas Render MCP expuestas y el ejecutable `render` no está en `PATH`. Se comprobó sólo su disponibilidad; no se instalaron herramientas ni se inició sesión. El panel de Render sigue siendo una vía para la configuración futura.

## Contrato de confirmación

El enlace de correo utiliza la ruta pública de la tienda y un token opaco aleatorio, de un solo uso y válido durante **una hora**:

```text
https://farmacia-reyna-del-cisne-pruebas.pages.dev/confirmar-correo#token=TOKEN_OPACO
```

`TOKEN_OPACO` es un marcador documental. El enlace no lleva un JWT de sesión. La página lee el fragmento y confirma mediante un POST a la API; visitar la ruta por GET no confirma una cuenta. El token no se debe registrar ni publicar. Su comprobación y consumo corresponden al servidor.

| Endpoint de la API | Cuerpo y función |
| --- | --- |
| `POST /api/auth/verify-email` | `{token}`: valida caducidad y uso único y confirma el correo. |
| `POST /api/auth/resend-verification` | `{email}`: solicita otro mensaje conforme a los límites del backend. |

Con el flujo habilitado, las nuevas altas quedan pendientes y no reciben un JWT hasta confirmar. El middleware impide usar una cuenta pendiente en operaciones autenticadas. `Usuario.emailVerifiedAt` sigue siendo nullable y `emailVerificationRequired` tiene valor inicial `false` para preservar las cuentas anteriores; conservar su acceso no significa atribuirles una confirmación de correo que nunca realizaron.

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

1. Elegir la escritura Reina/Reyna, consultar el registrador y decidir el registro del dominio y su renovación.
2. Disponer de una dirección de acceso bajo su control y crear su cuenta Resend.
3. Acreditar acceso al dominio/DNS y a los proyectos existentes de Cloudflare y Render; transcribir los registros que genere Resend y esperar la verificación.
4. Definir remitente, generar la clave y guardarlos de forma privada en Render con el origen HTTPS exacto.
5. Autorizar y realizar una prueba de envío a una dirección controlada. Comprobar recepción, caducidad, reutilización, reenvío, límites, cuentas pendientes y acceso de cuentas anteriores, sin usar datos comerciales.
6. Activar el flujo sólo después de comprobarlo. Mantener `EMAIL_VERIFICATION_ENABLED=false` hasta entonces.

Las comprobaciones locales y la consulta de documentación no acreditan entrega de correo, dominio adquirido, DNS propagado ni certificado emitido. Registrar o verificar un dominio tampoco activa PayPhone, SRI u otros servicios comerciales.

## Migración y restauración

Aplica las migraciones aditivas y genera el cliente Prisma 6 antes de arrancar el backend nuevo. El despliegue existente en Render ejecuta esa preparación; mantén `SKIP_INITIAL_SEED=true` para conservar los datos. En SQLite local, trabaja sobre una copia respaldada y revisa el destino antes de ejecutar `db:migrate`. No ejecutes el setup de una instalación nueva sobre una base comercial.

La migración y la restauración conservan el estado de verificación del usuario, pero no copian ni reactivan enlaces de confirmación. Las cuentas pendientes deben solicitar un enlace nuevo.
