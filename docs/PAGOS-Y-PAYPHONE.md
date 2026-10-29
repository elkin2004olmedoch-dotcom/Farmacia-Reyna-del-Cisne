# Pagos y preparación de PayPhone

La farmacia incorpora una demostración visual y el código de integración con el formulario alojado de PayPhone. **El propietario confirmó que todavía no tiene cuenta comercial. No se han proporcionado credenciales, conectado una cuenta ni probado pagos contra PayPhone, tampoco en su ambiente de pruebas.** `PAYPHONE_ENABLED=false` conserva el servicio cerrado. El código está publicado y la tabla aditiva aplicada; la [evidencia de pagos](PAGOS-2026-10-29.md) registra despliegues y comprobaciones. Esto no acredita una habilitación comercial.

## Tres experiencias distintas

| Experiencia | Requisitos y efecto |
|---|---|
| Demostración en `/pagos.html` | Usa artículos e importes ficticios y permite representar aprobación, rechazo o cancelación. Funciona sin cuenta PayPhone; no recoge tarjetas, crea pedidos, reserva stock ni escribe pagos. Una API caída no convierte el ejemplo en una compra. |
| PayPhone en pruebas | Requiere cuenta, aplicación WEB marcada **PRUEBAS**, token y StoreID de esa aplicación. `PAYPHONE_ENVIRONMENT=sandbox` etiqueta y conserva ese ambiente; la variable no transforma un token de producción en uno de pruebas. Usa el mismo host PayPhone que producción. |
| PayPhone en producción | Requiere habilitación y credenciales reales del comercio, dominio autorizado y validación previa del flujo completo. Puede cobrar dinero. Solo se activa deliberadamente con `PAYPHONE_ENABLED=true` y `PAYPHONE_ENVIRONMENT=production`. |

El pedido registrado abre `/pagos.html?pedido=ID`, exige sesión y consulta su importe histórico. La demostración se abre aparte: sus resultados nunca se aplican al pedido. «Coordinar con la farmacia» abre un mensaje de contacto por decisión del cliente; ese mensaje no acredita pago. Apple Pay permanece anunciado como no disponible hasta que exista una pasarela compatible habilitada para esta farmacia.

## Capas y contrato

La presentación conserva HTML/CSS/JavaScript y MVC: `frontend/models/payments.js` consume la API, `views/payments.js` representa el resumen y `controllers/payments.js` coordina interacción y navegación. `scripts/build-frontend.cjs` genera la pantalla. Express mantiene rutas, validación y JWT en `server/routes/pagos.cjs`, adaptación HTTP en `controllers/pagos.cjs` y reglas/transacciones en `models/pagos.cjs`; `models/payphone.cjs` limita configuración, destino y llamadas al proveedor. PrismaClient se reutiliza mediante `models/db.cjs`.

Todas las respuestas JSON conservan `{ok:true,data:...}` o el error común de la API.

| Ruta | Acceso y resultado |
|---|---|
| `GET /api/pagos/configuracion` | Pública: `{payphone:{disponible,entorno},demostracion:true,moneda:"USD"}`. Desactivado devuelve `disponible:false, entorno:null`, sin credenciales. |
| `GET /api/pedidos/:id/pago` | Propietario o admin; devuelve resumen del pedido, `pago` y configuración pública. Otro comprador recibe 404; repartidor, 403. |
| `POST /api/pedidos/:id/pago/payphone` | Propietario o admin; cuerpo vacío o `{}`. Rechaza importes y datos de tarjeta. Reserva una intención y prepara el formulario; devuelve 201 al crear y 200 al reutilizar. |
| `GET /api/pagos/payphone/respuesta?id=…&clientTransactionId=…` | Retorno público del proveedor. Valida identificadores, busca el pago guardado, ejecuta Confirm y redirige con 303 al origen público fijo `/pagos.html?pedido=ID_GUARDADO`. No acepta un destino enviado por el navegador. |

El DTO de consulta/preparación tiene esta forma; `pago` es `null` antes del primer intento:

```text
{
  pedido: {
    id, estado, createdAt, total, totalCentavos, subtotalCentavos,
    costoEnvioCentavos, ivaCentavos, moneda: "USD",
    detalles: [{nombreProducto, cantidad, totalCentavos}]
  },
  pago: {
    estado, proveedor: "payphone", entorno, moneda: "USD",
    totalCentavos, createdAt, updatedAt, urlPago
  },
  payphone: {disponible, entorno}, demostracion: true, moneda: "USD"
}
```

`ivaCentavos` puede ser `null` en pedidos antiguos. Su fiscalidad incompleta impide preparar un cobro: no se inventan impuestos. El DTO excluye identificación, correo, teléfono, dirección y credenciales del comprador. `urlPago` solo se entrega mientras está pendiente, habilitado y coincide el ambiente guardado; cambiar de ambiente impide reutilizar el intento con `PAYMENT_ENVIRONMENT_CHANGED`.

## Importes, confirmación y límites

`Pago` es la entidad adicional número 19; conserva las 18 anteriores y se relaciona de uno a uno con `Pedido`. Las migraciones aditivas `202610290008_payments` existen para SQLite y PostgreSQL. Guardan USD, total entero en centavos, base sin IVA, base gravada e IVA históricos, ambiente, referencias y fechas. Protegen la inmutabilidad del snapshot y la unicidad de pedido, `paymentId` y transacción del proveedor. PostgreSQL habilita RLS y revoca acceso directo público; el navegador utiliza Express, no tablas de Supabase.

El servidor obtiene los importes del pedido y sus líneas/envío. `amountWithoutTax + amountWithTax + tax = amount`, sin añadir IVA dos veces. La reserva se serializa con los cambios de pedido; las llamadas de red se ejecutan fuera de la transacción, con tiempo límite de 12 segundos y sin reintentos automáticos de POST.

Los estados son `creando`, `pendiente`, `aprobado`, `cancelado` y `revision`. Un retorno del navegador no prueba un pago. Confirm debe coincidir en transacción, referencia del comercio, importe, moneda, código y estado: `3/Approved` aprueba; `2/Canceled` cancela. Una discrepancia o respuesta incierta queda en revisión. Los callbacks concurrentes o repetidos no vuelven a confirmar. Según PayPhone, hay que confirmar dentro de los **cinco minutos posteriores al pago** o se revierte automáticamente; el plazo no empieza al preparar el enlace. [Protocolo oficial](https://docs.payphone.app/boton-de-pago).

Esta versión conserva **una intención por pedido**. Reutiliza la pendiente; no genera otra después de cancelación, revisión o interrupción. No tiene endpoint para forzar aprobación, consultar una venta desconocida, reiniciar intentos, emitir devoluciones ni registrar conciliaciones manuales. Un pago de producción creado, pendiente, aprobado o en revisión bloquea la cancelación del pedido y la devolución de inventario. Una prueba sandbox aprobada no cuenta como dinero recibido. Aprobar un pago nunca confirma, prepara ni entrega el pedido y nunca emite una factura SRI.

## Configuración y activación

Las variables privadas se configuran únicamente en el servidor; [.env.example](../.env.example) conserva valores vacíos y desactivados.

| Variable | Valor y condición |
|---|---|
| `PAYPHONE_ENABLED` | `false` por defecto; solo `true` solicita habilitar. |
| `PAYPHONE_ENVIRONMENT` | `sandbox` por defecto; admite `sandbox` o `production`. Debe corresponder a la aplicación/token realmente emitidos por PayPhone. |
| `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID` | Credenciales de la aplicación WEB del comercio; StoreID con formato UUID. Nunca se publican en Pages, HTML, JS, documentación ni logs. |
| `PAYMENT_PUBLIC_ORIGIN` | Origen HTTPS exacto del frontend, sin ruta ni barra final, incluido también en `CORS_ORIGIN`. |
| `PAYMENT_API_ORIGIN` | Origen HTTPS exacto del backend que recibe el retorno. No se obtiene de `Host` ni de parámetros del cliente. |

Si se mantienen los destinos actuales, el dominio WEB del comercio en PayPhone Developers debe corresponder al frontend **Cloudflare Pages** `https://farmacia-reyna-del-cisne-pruebas.pages.dev`; la URL de respuesta será **Render** `https://farmacia-reina-del-cisne.onrender.com/api/pagos/payphone/respuesta`. Verifica los destinos y su configuración reales antes de registrarlos: una URL de vista previa distinta también necesita autorización. No registres Render como dominio de origen cuando el cliente sale desde Pages.

Antes de habilitar:

1. Obtener la cuenta Business, acceso de desarrollador y aplicación WEB del propietario. Confirmar dominio, URL de respuesta y StoreID en la configuración real de PayPhone.
2. Respaldar y revisar la migración aditiva del proveedor activo antes de aplicarla. No ejecutar seed ni usar datos comerciales para probar el flujo. La actualización del 29 de octubre aplicó esta migración en Supabase con respaldo privado y comprobación de las 18 tablas existentes; no añadió dependencias. El estado verificable se registra en la evidencia de pagos.
3. Configurar primero la aplicación **PRUEBAS**, sus credenciales privadas y los orígenes HTTPS. Comprobar que `/api/pagos/configuracion` informa sandbox; esto comprueba configuración local, no certifica que PayPhone haya emitido credenciales de prueba.
4. Probar desde el dominio registrado la navegación al formulario oficial, importe/IVA, aprobación, cancelación, retorno, repetición, expiración de sesión y fallos de red. Mantener los datos de tarjeta en el formulario PayPhone y seguir sus instrucciones de prueba vigentes.
5. Verificar disponibilidad continua y latencia del callback. Un arranque en frío o indisponibilidad de Render Free puede consumir el plazo de cinco minutos; no habilitar cobros sin resolver la capacidad operativa de confirmar y conciliar fallos.
6. Acordar responsables y procedimiento de conciliación/devolución, incluidos los bloqueos que esta versión no permite resolver desde el panel. Solo después validar la cuenta y aplicación de producción y cambiar deliberadamente sus credenciales/ambiente. La evidencia de pruebas no sustituye esa habilitación.

El formulario se abre mediante navegación completa a `https://pay.payphonetodoesposible.com/Anonymous/Index?paymentId=…`, verificado en servidor y navegador; no usa iframe ni requiere debilitar CSP. `/pagos.html` servido por Express usa `strict-origin-when-cross-origin` para que PayPhone vea el origen registrado, sin ruta ni query del pedido. El callback mantiene `no-referrer`. Revisa también la cabecera del frontend servido por Pages. [Requisitos de dominio y referencia](https://docs.payphone.app/boton-de-pago).

## Revisión de incidencias y evidencia

Ante `creando` persistente, `revision`, cobro aparentemente realizado sin confirmación o ambiente cambiado, no repetir el pago ni crear otro pedido para intentar cobrarlo otra vez. Administración consulta el resumen autenticado; el equipo técnico obtiene mediante lectura autorizada los identificadores guardados de `Pago` (`id` enviado como `clientTransactionId`, `paymentId`, `providerTransactionId` cuando exista), pedido, ambiente, importe, moneda y fechas. El operador contrasta esos datos con el registro del comercio en PayPhone y, si corresponde, su soporte. No solicites PAN, CVV ni capturas con información de tarjeta.

Registra la evidencia y decisión sin datos sensibles. Si procede una reversión/devolución, debe gestionarse por los mecanismos que PayPhone habilite al comercio; esta aplicación no la ejecuta ni la detecta automáticamente. El bloqueo de cancelación no desaparece por consultar el portal o devolver dinero externamente. Resolver el estado local requiere un procedimiento de soporte auditado o una ampliación explícita: no improvisar cambios de estado o importes mediante SQL. [Operación de reversos del proveedor](https://docs.payphone.app/boton-de-pago).

Las pruebas de `tests/reto2/payments.test.cjs` utilizan Fetch simulado y SQLite temporal; la prueba PostgreSQL existente es optativa, exige una URL explícita de base sintética local y también simula PayPhone. Cubren autorización, snapshots, concurrencia, repeticiones, fallos, ambientes, redirecciones y conciliación. No acreditan una conexión al proveedor ni una transacción sandbox real. Los resultados completos y el estado de publicación se registran separadamente de esta guía.

Las referencias de presentación son [Stripe Checkout](https://docs.stripe.com/payments/checkout) para el resumen y flujo alojado y [Apple Human Interface Guidelines: Apple Pay](https://developer.apple.com/design/human-interface-guidelines/apple-pay) para claridad de la acción y disponibilidad. Son referencias de interfaz; no se integró Stripe ni se habilitó Apple Pay.
