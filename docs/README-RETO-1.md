# Farmacia Reina del Cisne

Tienda estática de farmacia adaptada al prototipo ATHLETIX ECOMMERCE: portada, búsqueda, catálogo, ficha, comparación, opiniones, cuentas locales, carrito, compra por pasos y consulta de pedidos. Conserva el contacto y los pedidos por WhatsApp.

Los productos y precios son de demostración. Las cuentas, opiniones y pedidos se guardan en el navegador. No existe un backend ni un cobro bancario: la opción de tarjeta es una simulación con números de prueba.

## Abrir el proyecto

Requiere Node.js para el servidor local, sin instalar dependencias:

```powershell
node scripts/serve.cjs
```

Abre **http://localhost:4173/**. Este modo permite usar las páginas con el mismo origen, conservar el carrito y registrar el service worker. El servidor solo escucha en la máquina local.

También puedes abrir `index.html` directamente para consultar el sitio. El almacenamiento compartido entre archivos, las cuentas y las APIs criptográficas dependen del navegador en `file://`; para probar todo el recorrido utiliza localhost o HTTPS.

## Pantallas y funciones

| Archivo | Función |
|---|---|
| `index.html` | Portada con la fachada del negocio, beneficios, selección de productos, categorías, promociones, ubicación y contacto |
| `catalogo.html` | Búsqueda por nombre, descripción o categoría; filtros; orden; añadido rápido y carrito lateral |
| `producto.html?id=solar` | Imagen ampliable, precio, cantidad, ficha del catálogo, relacionados y opiniones locales |
| `comparar.html` | Selección de productos y comparación de precio, categoría, presentación y entrega |
| `cuenta.html` | Registro, acceso, perfil y cierre de sesión locales |
| `checkout.html` | Carrito → datos y entrega → pago → confirmación |
| `pedidos.html` | Historial local, resumen descargable y consulta del pedido por WhatsApp |
| `ayuda.html` | Centro de ayuda, privacidad y condiciones de la demostración |

La cabecera comparte búsqueda, promociones, ayuda, cuenta y contador del carrito. El diseño conserva la identidad crema y vino de la farmacia, su fachada y la estructura de tienda del prototipo. Se mantienen los 18 productos publicados. Todas las imágenes y fuentes del sitio son locales.

## Validaciones

Las reglas están centralizadas en `js/validation.js` y se aplican a contacto, datos del comprador, registro y compra.

- Nombres y apellidos con letras, tildes y espacios, entre 2 y 80 caracteres.
- Correos con estructura válida, límites de longitud y control de puntos consecutivos. No se restringen a `.ec`.
- Celulares ecuatorianos `09XXXXXXXX`, fijos con código de área `02` a `07`, y formato internacional `+593` sin el cero inicial. Se normalizan a formato internacional.
- Cédula de 10 dígitos, provincia 01 a 24 o prefijo 30, tercer dígito de persona natural y verificador módulo 10.
- RUC de 13 dígitos terminado en 001: persona natural con módulo 10, sociedad privada y entidad pública con sus verificadores módulo 11.
- Las 24 provincias, ciudad o cantón, dirección y referencia; código postal opcional de 6 dígitos con prefijo de la provincia seleccionada.
- Contraseña de 8 a 128 caracteres, una letra y un número, y confirmación idéntica.
- Visa y Mastercard de 16 dígitos: marca, Luhn, mes, vencimiento vigente y CVV de 3 dígitos.
- Cantidades enteras de 1 a 99 y aceptación de condiciones.

La validación comprueba estructura y verificadores. No comprueba identidad con Registro Civil, registro activo en SRI, existencia de correo, titularidad de teléfono, dirección real, banco, tipo débito/crédito ni fondos. Las fuentes y el alcance están en [la revisión de adaptación y validaciones](docs/auditorias/AUDITORIA-10-tienda-ecuador.md).

## Probar una compra

1. Añade productos desde el catálogo o la ficha y abre **Carrito** en la cabecera.
2. Revisa cantidades. Puedes comprar como invitado o crear una cuenta local para agrupar tus pedidos.
3. Completa los datos con una cédula o RUC estructuralmente válido y elige retiro o entrega por coordinar.
4. Selecciona **Coordinar con la farmacia** o **Tarjeta · simulación**.
5. En la simulación, utiliza **Usar tarjeta de prueba**: completa la Visa de prueba para Ecuador `4000 0021 8000 0000`, un vencimiento futuro y un CVV de prueba.
6. Revisa las condiciones y registra el pedido. La confirmación indica que no se ha realizado un cobro.
7. Abre la consulta de WhatsApp para revisar el mensaje y enviarlo tú. Las pruebas automatizadas no envían mensajes.

La entrega tiene cobertura y costo pendientes de cotizar; no se suma una tarifa inventada. El precio final y la disponibilidad se confirman con la farmacia. El historial no simula una preparación o entrega que la farmacia no haya confirmado.

## Datos y persistencia

El catálogo proviene de `data/productos.json`. Para modificarlo, edita el JSON y ejecuta:

```powershell
node scripts/build-data.cjs
```

`productos-local.js` permite cargar productos sin un servidor dinámico. Los cálculos usan centavos y formato `es-EC`, moneda USD.

| Mecanismo | Datos |
|---|---|
| localStorage | Carrito, filtros, borradores de contacto y comprador, cuentas, opiniones, comparación e historial |
| sessionStorage | Sesión de cuenta y referencias a pedidos de invitado de esta sesión |
| IndexedDB | Catálogo y fecha de actualización |
| Cookie | Orden preferido, SameSite=Lax y Secure en HTTPS |

Las cuentas guardan un hash PBKDF2 con sal aleatoria de la contraseña de prueba. No se guarda la cédula del registro. Los pedidos conservan un documento enmascarado y, para tarjeta, marca y últimos cuatro dígitos. **Nunca se guardan ni se envían por WhatsApp el PAN completo, vencimiento o CVV.** Las cuentas locales no constituyen autenticación de producción.

El carrito se guarda sin descargar archivos automáticamente, conservando el comportamiento de la última versión publicada. Las fichas y la compra comparten el carrito. El historial permite descargar un resumen sin datos personales. Los formularios de contacto y comprador conservan sus botones para borrar borradores. Eliminar los datos del sitio en el navegador borra los datos locales.

## Uso sin conexión

El service worker guarda las ocho páginas, scripts, estilos, catálogo, fuentes e imágenes. Requiere localhost o HTTPS y una primera visita con conexión. Después permite navegar por las páginas guardadas sin internet. WhatsApp, el mapa y las redes externas necesitan conexión.

## Archivos de implementación

- `assets/shop.css`: adaptación visual de las pantallas.
- `js/commerce.js`: cuentas locales, sesión, pedidos, simulación y mensajes.
- `js/shop.js`: cabecera, ficha, comparación, opiniones, cuenta, compra e historial.
- `js/app.js`, `view.js`, `cart.js`, `storage.js`, `repo.js`, `form.js`: catálogo, carrito, carga, persistencia y contacto originales, integrados con la tienda.
- `scripts/build-shop.cjs`: genera las seis nuevas páginas y actualiza la cabecera, portada y catálogo. Edita las plantillas de este script si quieres regenerarlas; las modificaciones manuales de esas páginas generadas se sobrescriben al ejecutarlo.

## Verificación

```powershell
node --test tests/*.test.cjs
```

29 pruebas de lógica y recursos: cálculos, persistencia, validaciones ecuatorianas, cuentas, privacidad, campañas y archivos offline.

Las funciones `tests/*.browser.cjs` se ejecutan con Playwright sobre el servidor local. `shop.browser.cjs` prueba el recorrido de compra a 1440 y 375 px, registro y acceso, errores de formulario, historial y ausencia de desbordamiento en las ocho páginas. `teclado.browser.cjs` recorre los controles con Tab, Enter, Espacio y Escape; las otras pruebas comprueban accesibilidad y la confirmación de eliminación.

Se revisaron las ocho páginas con axe-core 4.10.3 y etiquetas WCAG A/AA en móvil. También se comprobaron las páginas en escritorio, el contraste del carrito y la navegación offline. No es una certificación ni sustituye una evaluación con lectores de pantalla y usuarios reales.

## Entrega y publicación

Para generar un ZIP con todas las páginas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/crear-entrega.ps1
```

La entrega se escribe en `entrega/Reto1_Olmedo_Elkin.zip`. El script incluye las ocho páginas y sus recursos. El ZIP anterior se actualiza solo al ejecutar este comando.

Para alojamiento estático, sube las ocho páginas, `assets/`, `data/`, `js/`, `service-worker.js` y `robots.txt`, conservando las rutas. `.github/workflows/pages.yml` despliega GitHub Pages al actualizar `main`.

## Promociones y futuro administrador

`data/promociones.json` contiene campañas separadas del HTML: identificador, título, descripción, etiqueta, producto, imagen, estado activo, orden y fechas opcionales ISO 8601 con zona horaria. Ecuador continental usa `-05:00`. El inicio es inclusivo y el fin exclusivo; campañas desactivadas, futuras o vencidas no se muestran. Una lista vacía muestra un mensaje de próximas novedades.

Por ahora hay dos ejemplos marcados como **vista previa**, sin descuentos ni precios inventados. Para publicar una campaña real, cambia sus datos y `demo` a `false`. Regenera la copia para apertura directa con `node scripts/build-promotions.cjs`. La caché offline utiliza la última versión instalada del sitio; actualizaciones reales requerirán conexión.

`js/promotions.js` expone `Farmacia.promotions.load()`: al implementar administrador y base de datos, esta función podrá consultar la API sin rehacer las tarjetas. En esa fase se implementarán autenticación, autorización y persistencia en servidor. Esta entrega no incluye administrador ni base de datos.
