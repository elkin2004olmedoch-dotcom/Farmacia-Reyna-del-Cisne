# Adaptación ATHLETIX a Farmacia Reina del Cisne

Revisión: 7 de octubre de 2026.

Se abrió y recorrió el [prototipo ATHLETIX ECOMMERCE](https://www.figma.com/proto/GCXpDtX8tVYFDF3QMCxlgR/ATHLETIX-ECOMMERCE?node-id=4-2). Se observaron portada, categorías, catálogo con filtros, ficha, cantidad y presentación, relacionados/comparación, descripción, ficha técnica, opiniones, confirmación de añadido, carrito, ayuda, acceso y registro. Se siguió el inicio del recorrido de compra desde el carrito hacia el acceso.

## Correspondencia de funciones

| Referencia | Adaptación |
|---|---|
| Cabecera con inicio, productos, búsqueda, ayuda, ingresar y carrito | Cabecera compartida en ocho páginas, búsqueda por texto/categoría y contador persistente |
| Hero oscuro con producto dentro de un círculo y llamada a comprar | Producto de cuidado personal y marca/colores de la farmacia |
| Beneficios y compra por categoría | Retiro, orientación, revisión y consulta del pedido; categorías de farmacia |
| Filtros de categoría/público/precio | Categorías propias, búsqueda, precio y orden. Las tallas y públicos de calzado se sustituyen por presentación y categoría del catálogo |
| Ficha, imagen, cantidad, talla | Imagen ampliable, presentación del catálogo, cantidad de 1 a 99. No se inventan variantes de un producto |
| Comparación, descripción, ficha técnica y opiniones | Tabla de información disponible, ficha del catálogo y opiniones locales sin valoración ficticia |
| Confirmación de añadido | Diálogo con unidades, total y botones de seguir o abrir carrito |
| Registro y acceso | Registro/acceso de demostración, contraseña con hash y sal, sesión por pestaña |
| Carrito, retiro, pago y confirmación | Compra por cuatro pasos, retiro o entrega por coordinar, datos ecuatorianos y tarjeta de prueba |
| Sigue tu pedido | Historial local, resumen, consulta por WhatsApp y estados pendientes claramente indicados |
| Centro de ayuda | Preguntas, contacto, privacidad y alcance de la demostración |

Se mantienen las fotografías, logo, fuentes, productos y precios originales. El proyecto continúa sin dependencias de compilación ni backend. Las imágenes de la referencia deportiva no se reutilizan.

## Fuentes de las reglas de Ecuador

- Teléfono móvil nacional de 10 dígitos y fijo con código de área: [instructivo de ARCOTEL](https://www.arcotel.gob.ec/wp-content/uploads/2020/12/FO-CTDE-63_ATH_SAI_V1-0_Aprobaci%C3%B3n_Firmado.pdf). Los ejemplos oficiales incluyen `0912345678` y `02-123-1234`; el proyecto acepta formato nacional y +593 y no valida líneas locales de siete dígitos sin área.
- Cédula de diez dígitos y comprobación módulo 10: [metodología de registros administrativos del INEC](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Bibliotecas/Libros/Metod_para_transformar_registros_admin_en_registros_estad.pdf), tabla de correcciones de cédula.
- Estructura RUC de persona natural, sociedad privada y entidad pública, tercer dígito y terminación 001: [material educativo del SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/5b1221c9-8031-42d2-bc71-2123021c0698/Libro%2Bsecundaria%2B-%2BEnero%2B2012.pdf). Se aplican los verificadores de la estructura clásica del documento, incluido décimo dígito cero para tipo 6.
- Código postal de seis dígitos y prefijo provincial: [portal oficial Código Postal Ecuador](https://www.codigopostal.gob.ec/html/que_es_codigopostal.html). El proyecto también comprueba correspondencia de los dos primeros dígitos con la provincia seleccionada.
- Número de prueba para tarjeta emitida en Ecuador: [documentación de pruebas de Stripe](https://docs.stripe.com/testing), tabla de tarjetas por país. Se usa `4000 0021 8000 0000`; también se aceptan tres números de prueba Visa/Mastercard indicados en `commerce.js`. Esto no constituye una integración de Stripe ni una aprobación bancaria.

El formato de tarjeta usa reglas de marca y Luhn, vencimiento vigente y CVV de tres dígitos para las marcas soportadas. Un PAN por sí solo no confirma emisor ecuatoriano, titular, tipo débito/crédito o saldo. La simulación rechaza tarjetas ajenas a la lista de prueba aunque pasen Luhn.

Los correos se validan por estructura y longitud, sin imponer `.ec` ni limitar proveedores. El nombre de ciudad y la dirección tienen controles de contenido y longitud; no se comprueba que la dirección exista.

## Límites concretos

Las reglas locales no sustituyen consultas de identidad al Registro Civil, registro activo al SRI, DNS/verificación del correo, confirmación telefónica ni autorización bancaria. No se envían solicitudes a estos servicios.

El historial no afirma que la farmacia haya recibido, preparado o entregado el pedido. El estado es registrado localmente; los siguientes pasos necesitan confirmación por WhatsApp. No se envían correos de confirmación. Las cuentas y opiniones tampoco se sincronizan entre dispositivos.

La tarjeta y el CVV existen únicamente durante la edición del formulario, y se limpian al registrar la simulación. El historial guarda solo marca, últimos cuatro dígitos y estado simulado. La cédula del registro no se conserva; el documento de compra queda enmascarado. Los mensajes de WhatsApp omiten esos documentos y todos los datos de tarjeta.

## Verificación realizada

- 24 pruebas Node de lógica, persistencia, recursos, validación y privacidad.
- Recorrido Playwright completo en 1440 y 375 px: búsqueda, filtro, carrito, ficha, opiniones, comparación, registro, acceso, entrega, errores, simulación e historial.
- Las ocho páginas se revisaron sin desbordamiento horizontal en esos anchos.
- Recorrido solo con teclado en 1280 y 375 px; foco del diálogo, Escape, confirmación, cantidades, filtros, menú, preguntas y contacto.
- Pruebas del carrito lateral y de un evento `close` atrasado al reabrir una confirmación.
- axe-core 4.10.3 con WCAG 2 A/AA y 2.1 A/AA en las ocho páginas en 375 px, sin infracciones reportadas. En escritorio se corrigió el contraste del resumen del carrito.
- Las siete páginas interiores se abrieron sin conexión después de la instalación de la caché, sin errores de JavaScript.
- No se enviaron mensajes de WhatsApp ni se realizaron cobros, registros de identidad o publicaciones externas.

Las auditorías 01 a 09 describen la versión anterior y deben leerse como antecedentes. Esta revisión y el README describen la adaptación actual.
