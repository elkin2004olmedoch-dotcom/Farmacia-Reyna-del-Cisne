# Facturación electrónica de la farmacia

El panel incluye la integración para **facturas electrónicas del SRI**: borrador, numeración, firma XAdES-BES, recepción, consulta de autorización, XML y representación impresa (RIDE). La configuración comienza en **PRUEBAS**. Está pendiente configurar el RUC y la firma reales del dueño y validar su emisión con el SRI antes de usarla en producción. La aplicación nunca convierte un pedido, un HTTP 200 o una respuesta pendiente en una factura autorizada. Las pruebas del proyecto emplean certificados sintéticos y respuestas simuladas: no demuestran autorización de un emisor real.

La referencia vigente consultada el 11 de octubre de 2026 es la **[ficha técnica SRI 2.34, actualizada en julio de 2026](https://www.sri.gob.ec/facturacion-electronica)**. El XML usa la versión de factura 2.1.0; la ficha exige firma XAdES-BES, PKCS12 y RSA-SHA1. La misma fuente distingue pruebas sin validez tributaria de producción autorizada. Su Anexo 26 exige **RUC Proveedor** en información adicional cuando se utiliza facturación de terceros. No se inventa ese RUC ni se presume la autorización de un certificado.

## Configurar desde administración

1. En **Facturación → Configuración**, guardar RUC real, razón social, nombre comercial opcional, direcciones matriz/establecimiento, códigos de establecimiento y punto de emisión, obligación contable y ambiente. Si el nombre comercial está vacío, se usa la razón social. La instalación implementa régimen general; contribuyentes especiales, RIMPE y otros tratamientos requieren ampliar su configuración fiscal antes de emitir.
2. Declarar si el software es propio. Para entregar el sistema a otra farmacia como proveedor, seleccionar software de terceros y completar el RUC real del proveedor. Se incorpora al XML y al RIDE.
3. Revisar **próximo secuencial** antes de empezar. Si el negocio ya emitía con esa serie/ambiente, introducir el siguiente número disponible. El sistema permite avanzar, pero impide reutilizar números asignados aquí. No consulta automáticamente numeración usada en otros programas.
4. Cargar el `.p12` del emisor, de hasta 2 MiB, y su contraseña en el formulario privado. El servidor comprueba RSA de al menos 2048 bits, correspondencia entre clave/certificado, fechas y firma del certificado cuando su emisor está incluido. Si encuentra un RUC explícito en el sujeto del certificado, lo compara con el emisor. Un formato correcto o estas comprobaciones no certifican inscripción, representación legal ni confianza de la autoridad emisora; la aceptación final corresponde al SRI.
5. Preparar un borrador desde un pedido, con identificación real, razón social/nombre, dirección, correo y **forma de pago real**. Se admite cédula o RUC. Indicar tarjeta o transferencia solamente declara el método en la factura; este módulo no procesa pagos bancarios.
6. Emitir y consultar desde el panel. Para producción, se exige confirmación al activar ese ambiente y otra confirmación de la factura concreta. El dueño debe probar antes con su emisor y firma reales. Los estados pendientes permiten reconsultar usando la misma clave.

Los pedidos anteriores que no conservan porcentaje/base/IVA por línea se rechazan con `NEED_TAX_SNAPSHOT`. Si la tarifa general de una línea gravada ya no coincide con la vigente al intentar su primera emisión, se exige conciliación con `NEED_TAX_RECONCILIATION`; se conservan los importes originales. Ese bloqueo no reclasifica productos de tarifa 0% ni determina automáticamente el momento tributario de la venta. Para bienes, la [LRTI, artículo 61.1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/12c884d5-c8d9-4171-becc-1513b990b87a/LEY_DE_REGIMEN_TRIBUTARIO_INTERNO_LRTI.pdf) establece entrega o pago/acreditación total o parcial, lo que ocurra primero; el administrador debe revisar esos hechos al conciliar. Las facturas ya numeradas mantienen fecha, tarifa, clave y XML al reintentar.

## Persistencia y seguridad

`ConfiguracionEmisor` conserva configuración y firma **cifrada con AES-256-GCM**. La clave se deriva del secreto privado estable del servidor mediante HKDF con dominio específico y sal aleatoria; cada guardado usa un IV aleatorio. No se devuelve certificado, contraseña ni clave privada. Cambiar el `JWT_SECRET` sin conservarlo vuelve inaccesible esa copia de la firma: deberá volver a cargarse. El respaldo de la base de datos no basta para recuperar la firma sin ese secreto.

OpenSSL importa PKCS12 por entrada estándar; la contraseña se entrega únicamente mediante una variable privada del proceso hijo. No se escribe una clave privada en disco ni se incluye la contraseña en argumentos o mensajes. La importación tiene tiempo y memoria limitados. En Windows se detecta OpenSSL de Git; puede configurarse `OPENSSL_PATH`. En Render/Linux se necesita OpenSSL disponible. La API informa `capacidades.opensslDisponible`; si falta, la importación falla explícitamente y no simula una firma.

`FacturaPedido` guarda una copia inmutable de comprador, emisor, productos, descuento, IVA y total; el catálogo posterior no altera esa factura. `SecuenciaFactura` asigna numeración por RUC, ambiente, establecimiento y punto, con transacción, unicidad y reintentos limitados. Una factura por pedido y un bloqueo temporal impiden emisiones simultáneas duplicadas. Las tres tablas activan RLS en PostgreSQL/Supabase sin políticas de acceso público.

SOAP usa exclusivamente los servicios HTTPS oficiales de pruebas/producción, con timeout de 12 segundos por llamada, límite de respuesta, sin redirecciones y sin DTD/entidades externas. Una autorización se guarda únicamente cuando estado, número, clave, ambiente, firma y contenido corresponden a lo enviado. Ante una caída se conserva el XML para reintentar; `DEVUELTA`, `NO_AUTORIZADA`, `EN_PROCESO` y `ERROR` conservan su significado.

El XML/RIDE requieren sesión: sólo administradores y dueño del pedido pueden descargarlos. Los listados enmascaran la identificación. El RIDE es HTML imprimible con totales, tarifa, descuento, método de pago, clave y autorización; puede guardarse como PDF con el navegador. Mientras falta autorización de producción muestra **SIN VALIDEZ TRIBUTARIA**. Las notas de crédito, anulación fiscal, retenciones, guías, conciliación automatizada y envío de correos son desarrollos posteriores. Se bloquea la cancelación de un pedido cuya factura tenga numeración asignada, XML firmado o emisión en proceso; no se devuelve inventario mediante una anulación fiscal ficticia.

## API y comprobaciones

Todas las rutas se publican bajo `/api`. Configuración, firma y emisión requieren administrador.

| Método/ruta | Función |
| --- | --- |
| `GET/PUT /admin/facturacion/configuracion` | Configuración segura; `secuencialInicial` opcional sólo permite avanzar. |
| `POST /admin/facturacion/certificado` | `{archivoBase64,password}`; autenticación antes del parser de 3 MiB. |
| `GET /admin/facturacion/facturas` | Paginación `page` y `limit` o `pageSize`. |
| `POST /admin/facturacion/facturas` | `{pedidoId,tipoIdentificacion,identificacionComprador,razonSocialComprador,direccionComprador,correoComprador,formaPago}`. |
| `POST /admin/facturacion/facturas/:id/emitir` | `{}` en pruebas; `confirmarEmisionProduccion:true` en producción. |
| `GET /pedidos/:id/factura` | Metadatos del pedido propio, sin documento completo. |
| `GET /facturacion/facturas/:id/xml` | XML firmado o autorización comprobada. |
| `GET /facturacion/facturas/:id/ride` | Representación imprimible protegida. |

Se verifican clave de acceso de 49 dígitos/módulo 11 y fecha ecuatoriana, PKCS12, cifrado/alteración, tres referencias firmadas, rechazo de firma alterada, XML 2.1.0 contra XSD oficial, recepción/autorización, unicidad/concurrencia, persistencia, permisos y rechazo de pedidos históricos. El test XSD utiliza Python con `lxml` y archivos públicos locales del SRI/W3C, sin descargar nada durante la prueba; si falta ese validador se informa como omitido. Ninguna prueba emite un comprobante real.

Ejecutar: `node --test --test-concurrency=1 tests/reto2/sri-*.test.cjs`.
