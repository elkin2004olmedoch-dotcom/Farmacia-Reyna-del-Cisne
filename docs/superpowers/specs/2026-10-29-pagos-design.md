# Pagos y enlaces de la farmacia

La tienda conserva HTML/CSS/JavaScript, Express y Prisma 6, las mascotas y la identidad crema/vino. El propietario autoriza continuar y confirma que todavía no dispone de una cuenta comercial: preparar PayPhone, sin habilitar cobros reales.

## Experiencia

`pagos.html` ofrece un resumen claro, elección de método y una acción principal. Referencias de estructura: [Stripe Checkout](https://docs.stripe.com/payments/checkout) y [Apple Pay HIG](https://developer.apple.com/design/human-interface-guidelines/apple-pay); composición y recursos propios. En navegación y pedidos habrá enlaces descriptivos. Se conserva Farmi. Se retira el control flotante de WhatsApp y los enlaces sociales sin perfil conocido; el soporte escrito usa el dominio oficial, sin acortadores.

Sin pedido, la página permite una demostración pública con importes ficticios, resultados aprobado/rechazado/cancelado y ningún dato de tarjeta. No llama a pagos, pedidos ni inventario. Con `?pedido=<id>` requiere sesión y propiedad del pedido o administración: resumen del servidor, tarjeta mediante PayPhone cuando esté configurado y coordinación con la farmacia mientras tanto. La demostración se abre por separado y nunca paga ese pedido. No habrá un botón de Apple Pay ficticio: se explicará su activación futura por una pasarela compatible para esta farmacia.

## Tres capas

- Presentación: plantilla generada, vista y controlador de pagos separados; estado de carga/error, teclado, foco y diseño móvil. Sin SDK de terceros ni secretos de pago en el navegador.
- Aplicación: autorización, adaptador PayPhone con destino HTTPS fijo, total/IVA calculados desde el pedido guardado, límites y confirmación remota. Las URLs del proveedor se validan; nunca se confía en el importe ni en el resultado del navegador.
- Persistencia: una entidad Pago asociada de forma única al pedido, identificadores aleatorios, moneda/centavos/entorno/estado y referencia del proveedor. Migraciones aditivas equivalentes para SQLite y PostgreSQL, con RLS y acceso revocado a roles públicos. No se guarda PAN, CVV ni respuesta bancaria completa.

PayPhone alojado se prepara en el servidor, abre el navegador directamente y confirma desde el servidor en el retorno obligatorio dentro de cinco minutos. No es un webhook firmado. Las operaciones de red quedan fuera de transacciones. Repeticiones no crean otro cobro; estados inciertos requieren conciliación. Un pago no cambia automáticamente la dispensación, la entrega o la factura SRI. El entorno de pruebas de PayPhone y la demostración propia se identifican por separado.

## Alternativas y decisiones

Se elige checkout alojado para mantener los datos de tarjeta en el proveedor. Un formulario propio que recoja tarjetas amplía innecesariamente el alcance y las obligaciones; una segunda pasarela ahora carece de cuenta y necesidad confirmada. El adaptador permite ampliar proveedores conservando contratos y reglas comunes. Apple Pay requiere habilitación comercial compatible; no se promete con la cuenta pendiente de PayPhone.

## Verificación y publicación

Pruebas de autorización, importes, idempotencia, retornos falsos, destinos maliciosos, tiempo de espera, cancelación y separación de entornos en bases temporales. Recorrido de navegador en escritorio y móvil para demostración, pedidos, errores, mascota y teclado. Ninguna tarjeta real, cobro o venta de prueba en producción. Antes de publicar: revisar diferencias, secretos y migración; copia privada y comparación de datos existentes si se aplica la migración en Supabase. Mantener el despliegue existente de Render y Cloudflare Pages y el PR de revisión.

## Activación pendiente

Crear cuenta PayPhone Business, configurar aplicación WEB en PRUEBAS, cargar credenciales privadas en Render y comprobar un retorno real en ese entorno. La habilitación de producción exige cambiar la aplicación y configuración al entorno comercial y validar la cuenta. Sin esas credenciales solo se verifica el adaptador contra respuestas de prueba controladas, nunca se afirma conexión bancaria.
