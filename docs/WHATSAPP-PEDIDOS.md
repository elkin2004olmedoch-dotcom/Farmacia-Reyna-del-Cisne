# WhatsApp y seguimiento de pedidos

Investigación de documentación oficial de Meta: **11 de octubre de 2026**. **Estado: conexión pendiente y aplazada hasta disponer de los datos del dueño.** Este documento define el contrato recomendado para una conexión futura con WhatsApp Cloud API. No acredita que la farmacia tenga una cuenta API aprobada, un número conectado ni mensajes reales enviados. El seguimiento y las confirmaciones deben funcionar en la web aunque WhatsApp no esté configurado.

## Alcance para una farmacia

La política de Meta, actualizada el 23 de septiembre de 2026, restringe medicamentos y productos sanitarios. Ecuador admite mensajes sobre medicamentos de venta libre bajo requisitos legales y de edad, pero esa excepción no permite experiencias de comercio de bienes regulados. Ocultar nombres no habilita confirmar compras por WhatsApp. La integración debe permanecer desactivada hasta comprobar la elegibilidad del negocio y del uso concreto. Las confirmaciones de medicamentos con receta y la entrega se gestionan en la web. Fuente: [política de WhatsApp Business, secciones 4–5](https://whatsappbusiness.com/policy/).

La propuesta limita cualquier notificación que resulte elegible a referencia del pedido y estado. No envía automáticamente medicamentos, recetas, diagnósticos, cédula, datos de tarjeta, dirección ni ubicación. El cliente consulta sus detalles con sesión; el repartidor sólo accede a las entregas que tenga asignadas. Un vínculo informativo tampoco evita las restricciones de Meta: debe revisarse su finalidad antes de habilitarlo.

## Recorrido de pedido en la web

| Paso | Quién actúa | Cambio que se guarda |
| --- | --- | --- |
| Pedido creado | Cliente con sesión | `pendiente`, datos de entrega y reserva de inventario. |
| Confirmación | Farmacia desde el panel | `pendiente → confirmado`. Una respuesta del cliente no acredita disponibilidad ni receta revisada. |
| Preparación terminada | Farmacia | `confirmado → preparado`, después de verificar dispensación, receta cuando corresponda y lotes vigentes. |
| Entrega asignada | Farmacia | Repartidor autorizado vinculado a ese pedido; no concede acceso a otros pedidos. |
| Entrega realizada | Repartidor asignado o administrador autorizado | `preparado → entregado`, con actor y fecha en el historial. |
| Estado visible | Cliente propietario | Mis pedidos consulta el estado persistido; se actualiza al refrescar o mediante actualización periódica autenticada. |

Es una propuesta para incorporar la entrega asignada al flujo existente `pendiente → confirmado → preparado → entregado`. No debe confundirse una confirmación de recepción del cliente con una aceptación de la farmacia. El botón de entrega debe funcionar también con teclado. Los estados finales no retroceden; una cancelación mantiene los controles de inventario y de facturas SRI ya implementados.

## Lo que debe configurar el dueño

Tener instalada la aplicación de WhatsApp o WhatsApp Business no crea una conexión API. Para Cloud API hacen falta un portfolio comercial de Meta, cuenta de WhatsApp Business (WABA/cuenta de mensajes), número empresarial registrado, aplicación Meta y sus permisos. Deben obtenerse **Phone Number ID**, WABA ID y token de acceso de sistema/empresa autorizado para `whatsapp_business_messaging`; la gestión de activos o plantillas puede requerir `whatsapp_business_management`. También hacen falta **App Secret** y un **Verify Token** aleatorio propio para el webhook. El token temporal de pruebas no es una configuración permanente. Fuente: [colección oficial Cloud API de Meta: requisitos, tokens y permisos](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api).

El servidor público necesita HTTPS con certificado válido, suscripción de la app al campo `messages` de su cuenta, consentimiento para las comunicaciones correspondientes y revisión de elegibilidad. No se crean cuentas, credenciales ni suscripciones desde este documento. Token, App Secret y Verify Token deben almacenarse únicamente en configuración privada del servidor, o cifrados con una clave privada estable y dominio exclusivo de WhatsApp. El panel devuelve presencia y estado de configuración, nunca sus valores. No se incluyen en GitHub, ZIP, JavaScript público, URLs ni registros.

Si se necesita conservar el mismo número en la aplicación **WhatsApp Business** y en Cloud API, Meta ofrece el alta de coexistencia mediante Embedded Signup. La guía exige aplicación Business compatible, socio de soluciones o proveedor de tecnología y webhook preparado; no se obtiene conectando WhatsApp Web. La app móvil y API pueden coexistir tras ese alta, pero los mensajes API conservan sus reglas de precios y ventana. La guía indica que las versiones 2 y 3 de Embedded Signup se retiran el **15 de octubre de 2026**: cualquier alta nueva debe revisar la versión 4 vigente. La disponibilidad real se comprueba durante el alta; no se promete para una cuenta WhatsApp personal. Fuente: [alta oficial de usuarios de WhatsApp Business/coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).

## Ventana, plantillas y costos

Cada mensaje entrante del usuario abre o reinicia una ventana de atención de **24 horas** para responder sin plantilla. Fuera de ella se requieren plantillas aprobadas. Una actualización de pedido que resulte elegible debe ser de utilidad, específica y sin promociones; su categoría/aprobación la determina Meta. La plataforma cobra por mensajes entregados según mercado y categoría, con excepciones para servicio y utilidad en respuesta al usuario. No se garantiza gratuidad permanente ni se fija una tarifa para Ecuador sin revisar el tarifario al activar la cuenta. Fuente: [precios oficiales y categorías de mensajes](https://whatsappbusiness.com/products/platform-pricing/).

Un enlace `wa.me` abre una conversación para que la persona envíe un mensaje; por sí solo no recibe webhooks ni actualiza pedidos. No debe mostrarse como automatización activa. No se usan bots que imiten WhatsApp Web, sesiones extraídas del teléfono, ni SMS como sustituto silencioso de esta integración.

## Contrato técnico propuesto

Las rutas siguientes son una propuesta de integración, **no una declaración de API ya habilitada**. La página de la farmacia conserva sus controles normales de autenticación y permisos.

| Punto | Contrato |
| --- | --- |
| Configuración administrativa | Configuración segura con `habilitado=false` inicialmente, identificadores públicos, presencia de secretos, versión Graph validada y plantillas aprobadas. Activar requiere elegibilidad y configuración completa. |
| `GET /api/integraciones/whatsapp/webhook` | Exigir `hub.mode=subscribe`, comparar `hub.verify_token` con Verify Token privado y devolver el `hub.challenge` literal con HTTP 200. Un token incorrecto recibe 403. |
| `POST /api/integraciones/whatsapp/webhook` | Cuerpo original de bytes limitado, HMAC verificado antes de interpretar JSON, validación de cuenta/número empresarial y almacenamiento de eventos aceptados. |
| Mensajes salientes | `POST https://graph.facebook.com/{version}/{phoneNumberId}/messages`, Bearer privado, `messaging_product: whatsapp`. Host fijo, versión explícita compatible, timeout y respuesta limitada. |
| Acción de pedido | Servicio interno único de estados: comprueba actor, asignación, transición y versión del pedido; guarda cambio, historial y consumo de acción en una misma transacción. |

Meta valida el callback por GET y firma POST con `X-Hub-Signature-256: sha256=<digest>`, usando HMAC-SHA256 y App Secret. Se calcula sobre los **bytes recibidos**, nunca sobre JSON vuelto a serializar. Comparar digests del mismo tamaño en tiempo constante; rechazar firma ausente/malformada y secretos faltantes. El Verify Token de GET no autentica los POST. La guía específica de WhatsApp prevé reintentos durante **7 días**, por lo que se debe deduplicar; no depende del plazo diferente que muestra la guía Graph genérica. Fuente: [crear webhook, actualización del 17 de junio de 2026](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/).

Se recomienda procesar todos los elementos `entry[]/changes[]/messages[]`, comprobar `object=whatsapp_business_account`, `field=messages`, cuenta y `metadata.phone_number_id` configurados. Guardar `messages[].id` con restricción única y resultado; devolver 200 cuando el evento válido esté registrado de forma durable. Los reintentos no repiten cambios. Una caída de base de datos no se confirma como procesada. Usar cola persistente para el envío y reintentos controlados; no mantener secretos o datos clínicos dentro de la cola. Los estados de mensaje `sent`, `delivered`, `read` o `failed` describen **el mensaje**, nunca la entrega física del pedido. Fuente: [payload oficial Cloud API](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).

Para una acción que sea elegible, los botones interactivos se envían con `type=interactive`, `interactive.type=button`, `action.buttons[].reply.id/title`. Meta admite hasta tres botones, título de hasta 20 caracteres e identificador de hasta 256. El webhook devuelve `interactive.button_reply.id`; debe usarse ese identificador, no el texto visible. Fuente: [botones de respuesta, actualización del 21 de mayo de 2026](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages/).

Las respuestas a botones interactivos incluyen `from`, identificador del mensaje entrante y `context.id` del mensaje original. Las respuestas rápidas de una plantilla llegan como `type=button` con `button.payload` y contexto; son un formato distinto. No se supone que `contacts[].wa_id` siempre sea igual al teléfono. Fuentes: [webhook interactivo, actualización del 3 de agosto de 2026](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/interactive/), [webhook de botón de plantilla](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/button/).

## Vincular la respuesta al pedido y al actor

Esta es una decisión de seguridad de la aplicación: generar un token aleatorio opaco para cada acción y guardar únicamente su hash, pedido, actor permitido, teléfono/identidad de origen esperados, acción, estado esperado, mensaje saliente `wamid`, vencimiento y fecha de consumo. `reply.id` o el payload deben referirse a ese token, sin dirección, cédula ni nombres de medicamentos. Exigir coincidencia del contexto y de la identidad previamente vinculada, acción no vencida y transición válida. Un número escrito por un tercero no lo convierte en repartidor.

Un **OK libre no cambia el último pedido**. Si una implementación futura acepta texto, debe exigir una respuesta contextual al mensaje específico y una única acción activa compatible, o pedir continuar en la web con sesión. No seleccionar pedidos por nombre, por orden de llegada ni por teléfono solamente. El repartidor puede confirmar únicamente la entrega asignada; el cliente no obtiene permiso de administrador por responder. Si llegan dos confirmaciones o el estado cambia mientras tanto, la segunda es inocua o se rechaza sin repetir movimientos.

Los registros conservan actor, transición, evento y resultado necesarios para auditoría, con retención limitada; no el contenido completo de conversaciones ajenas al pedido. El cliente mantiene control para dejar de recibir mensajes. Las pruebas previas deben usar eventos sintéticos: firma inválida, duplicados, cuenta/número equivocados, token vencido o reutilizado, actor ajeno, respuesta ambigua, caída de base de datos y concurrencia. La activación y cualquier prueba de mensajes reales requieren que el dueño complete el alta y autorice los destinatarios concretos.
