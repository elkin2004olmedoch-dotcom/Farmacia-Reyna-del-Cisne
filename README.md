# Farmacia Reina del Cisne

Sitio estático del Reto 1: catálogo y carrito con cantidades, filtros, subtotal, total, uso sin conexión después de la primera visita por HTTPS y datos persistentes en el navegador. Los productos y precios son de demostración; el pedido se envía por WhatsApp.

## Uso

1. Descomprime la entrega conservando las carpetas.
2. Abre `index.html` en un navegador actual (Chrome, Edge, Firefox o Brave).
3. Entra en **Productos**, añade artículos y abre **Carrito**.
4. Cambia cantidades, elimina productos y recarga para comprobar la persistencia.
5. En el carrito, escribe el nombre, teléfono y dirección del comprador para preparar el pedido. No necesitas crear una cuenta; al confirmar, WhatsApp abre el mensaje para que lo revises y lo envíes.
6. Abre la portada y el catálogo al menos una vez con internet desde GitHub Pages. Después puedes recargar y recorrer el sitio sin conexión; el pedido quedará guardado hasta que vuelvas a tener internet para enviarlo por WhatsApp.
7. Al añadir productos, cambiar cantidades, confirmar una eliminación o vaciar el carrito, el navegador descarga automáticamente `carrito-reina-del-cisne.json`. Puedes abrir el archivo en VS Code o en un editor de texto para mostrar la selección.

No necesita instalación, servidor dinámico ni backend. Imágenes, estilos, fuentes y scripts están incluidos. El uso offline con el service worker requiere HTTPS (como GitHub Pages) y una primera visita con internet. Si abres directamente los archivos con `file://`, el carrito se guarda, pero el navegador no permite instalar el service worker. WhatsApp, redes y Google Maps necesitan Internet.

## Estructura

```text
index.html                 Portada y formulario
catalogo.html              Catálogo y diálogo del carrito
assets/
  styles.css               Diseño responsive con Flexbox y Grid
  accesibilidad.css        Controles, contraste y recorrido de compra
  images/                  Logo y fotografías locales
  fonts/                   Fuentes locales
  vendor/                  Bootstrap Grid y estilos de fuentes
data/
  productos.json           Fuente de los productos
  productos-local.js       Copia generada para apertura directa
js/
  app.js                   Inicialización, filtros, menú y eventos
  repo.js                  Carga y validación del catálogo
  cart.js                  Cantidades e importes en centavos
  storage.js               Almacenamiento y recuperación
  view.js                  Tarjetas reutilizables y carrito
  validation.js            Expresiones regulares
  form.js                  Errores accesibles y borrador de consulta
  offline.js               Estado de conexión e instalación del service worker
service-worker.js           Guarda la página y sus recursos para uso offline
scripts/build-data.cjs      Genera la copia local del JSON
tests/                     Pruebas con Node.js
AUDITORIA.md                01: estructura HTML e index
AUDITORIA-02-*.md           02: CSS y diseño responsive
AUDITORIA-03-*.md           03: catálogo, JavaScript y JSON
AUDITORIA-04-*.md           04: búsqueda, filtros y orden
AUDITORIA-05-*.md           05: carrito y cálculos
AUDITORIA-06-*.md           06: persistencia e IndexedDB
AUDITORIA-07-*.md           07: formulario y WhatsApp
AUDITORIA-08-*.md           08: accesibilidad y teclado
AUDITORIA-09-*.md           09: pruebas, recursos y publicación
```

## Explicación técnica

JavaScript ES6+ dividido en módulos encapsulados mediante `Farmacia`. Se utilizan scripts clásicos con `defer` para permitir la apertura `file://`, sin los bloqueos que pueden tener los imports ES Modules en ese modo.

En HTTP/HTTPS, `repo.js` carga `data/productos.json` con `fetch`. Al abrir el HTML directamente utiliza `productos-local.js`, generado desde el mismo JSON. Para editar productos, modifica el JSON y ejecuta `node scripts/build-data.cjs`; ambas versiones deben mantenerse iguales.

El carrito admite de 1 a 99 unidades por producto. Calcula importes en centavos para evitar errores decimales. Subtotal y total coinciden porque la demostración no añade recargos; la farmacia confirma el importe final.

La descarga JSON refleja el carrito en el momento de cada cambio. Contiene identificador y nombre de cada producto, cantidad, precio unitario, subtotal por producto, unidades, subtotal y total en USD, fecha de exportación y última actualización. Se genera en el navegador con `JSON.stringify`, `Blob` y una URL temporal; no necesita backend ni botón de descarga. Vaciar el carrito genera una lista vacía con total cero. Recargar, filtrar o cancelar una eliminación conserva la selección sin generar otra descarga. El archivo se guarda en la ubicación elegida por el navegador, no dentro de `data/`; la configuración del navegador controla las descargas múltiples.

## Persistencia

| Mecanismo | Información guardada |
|---|---|
| localStorage | Carrito, búsqueda, categoría, filtros, orden, borradores del formulario y datos del comprador |
| IndexedDB | Caché del catálogo y su fecha de actualización |
| Cookie `farmacia-sort` | Orden preferido durante 30 días; SameSite=Lax y Secure en HTTPS |

La selección antigua se migra a cantidades. Datos corruptos o productos retirados se descartan. Si se bloquea el almacenamiento, se informa y el carrito funciona temporalmente. Los borradores del formulario y el nombre, teléfono y dirección del comprador se guardan en el navegador de este dispositivo para continuar después; usa **Borrar datos guardados** para eliminarlos. No se envían hasta confirmar y abrir WhatsApp. Las cookies pueden estar limitadas en `file://`; el carrito, filtros y formularios utilizan localStorage.

El service worker guarda las dos páginas, los scripts, estilos, fuentes, catálogo e imágenes locales. Al recargar sin conexión sirve esos archivos desde la caché. La red sigue siendo necesaria para WhatsApp, enlaces externos y el mapa.

## Accesibilidad

HTML semántico, enlace para saltar al contenido, textos alternativos, foco visible y controles nativos. El carrito usa `dialog`: mantiene el foco dentro, se cierra con Escape y devuelve el foco al botón de apertura. Las categorías admiten flechas, Inicio y Fin. Los errores usan `aria-invalid` y `aria-describedby`; cambios y resultados se anuncian con regiones live. El menú móvil utiliza `aria-expanded` y se respeta movimiento reducido.

El catálogo reúne búsqueda, precio y orden arriba; las tarjetas indican las unidades añadidas y un resumen permite abrir el carrito. El botón de la cabecera muestra solo el icono y el contador, con un nombre accesible para lectores de pantalla. Quitar un producto abre una confirmación: **Cancelar** o Escape conserva el producto y devuelve el foco a **Quitar**; **Sí, quitar** lo elimina y pasa el foco al siguiente producto. Al eliminar el último, el foco pasa a **Explorar productos**. Los errores del formulario enlazan con cada campo. Usa Tab/Mayús+Tab para recorrer controles y Enter/Espacio para activar botones.

Se comprobaron el árbol de accesibilidad del navegador, teclado, anchos de 320 a 1440 píxeles y axe-core 4.10.3 en portada, formulario y carrito. No se ha realizado una sesión real con NVDA/JAWS/VoiceOver ni con usuarios ciegos; las pruebas automáticas no son una certificación de accesibilidad universal. El mapa externo requiere una revisión independiente; existe un enlace directo como alternativa.

## Pruebas y publicación

Con Node.js: `node --test tests/*.test.cjs`. No requiere instalar paquetes.

Las pruebas `tests/accesibilidad.browser.cjs` y `tests/teclado.browser.cjs` son funciones para ejecutar con Playwright sobre un servidor local en el puerto 4173. La segunda recorre catálogo, confirmación, cantidades, filtros, menú móvil, preguntas frecuentes y formulario usando solo teclado, en anchos de 1280 y 375 píxeles.

`tests/dialogo.browser.cjs` comprueba que cancelar y reabrir la confirmación conserve el producto pendiente incluso si llega un evento `close` atrasado.

GitHub Pages publica la rama `main`. Para Neocities, sube `index.html`, `catalogo.html`, `robots.txt` y las carpetas `assets`, `data` y `js` conservando las rutas. No subas el ZIP como sustituto de los archivos de la web.

Sitios: [Neocities](https://proyecto01.neocities.org/) y [GitHub Pages](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/).

Bootstrap Grid 5.3.3 (MIT), DM Sans y Fraunces (Google Fonts); fotografías generales de Unsplash. Logo, fotografía de la fachada e imágenes de Eucerin y Pigeon proporcionados para el proyecto. La paleta combina fondos crema, tarjetas blancas y detalles rojos; el pie utiliza rojo vino con textos y logo en crema, sin recuadro alrededor del PNG transparente.
