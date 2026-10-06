# Farmacia Reina del Cisne

Sitio estático del Reto 1: catálogo y carrito con cantidades, filtros, subtotal, total, uso sin conexión después de la primera visita por HTTPS y datos persistentes en el navegador. Los productos y precios son de demostración; el pedido se envía por WhatsApp.

**Sitio web:** [Neocities](https://proyecto01.neocities.org/) · [GitHub Pages](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/).

## Estructura solicitada en el reto

Los archivos de entrada están en la raíz del repositorio. Los estilos y recursos están en `assets/`, los datos en `data/` y los scripts en `js/`. La documentación complementaria se encuentra en `docs/`.

```text
Farmacia-Reyna-del-Cisne/
├── index.html                  Entrada: header, nav, main y footer
├── catalogo.html               Catálogo de productos y carrito
├── README.md                   Instrucciones y explicación técnica
├── assets/
│   ├── styles.css              Diseño adaptable con Flexbox y Grid
│   ├── accesibilidad.css       Foco visible, contraste y controles
│   ├── images/                 Imágenes y textos alternativos en HTML/JS
│   ├── fonts/                  Fuentes locales
│   └── vendor/                 Bootstrap Grid y estilos de fuentes
├── data/
│   ├── productos.json          Fuente de datos del catálogo
│   └── productos-local.js      Copia para abrir sin servidor
├── js/
│   ├── app.js                  Inicialización, filtros y eventos
│   ├── repo.js                 Carga y validación de productos
│   ├── view.js                 Tarjetas reutilizables y vista del carrito
│   ├── cart.js                 Cantidades, subtotal y total
│   ├── storage.js              localStorage, IndexedDB y cookies
│   ├── validation.js           Validación mediante regex
│   ├── form.js                 Formulario y errores accesibles
│   └── offline.js              Conexión y registro del service worker
├── docs/
│   ├── auditorias/             Revisiones técnicas del proyecto
│   └── agentes/                Documentación de herramientas de apoyo
├── scripts/
│   ├── build-data.cjs          Genera la copia local del JSON
│   └── crear-entrega.ps1       Genera el ZIP para el aula virtual
├── tests/                      Pruebas de lógica, recursos y accesibilidad
├── .github/workflows/pages.yml Publicación automática en GitHub Pages
├── .gitignore                  Excluye entregas y archivos temporales
├── robots.txt
└── service-worker.js           Caché para uso sin conexión
```

## Relación con los requisitos

| Requisito | Implementación |
|---|---|
| HTML5 semántico | `index.html` y `catalogo.html`: `header`, `nav`, `main`, `footer` |
| Diseño responsive | `assets/styles.css` y `assets/accesibilidad.css`: Flexbox, Grid y media queries |
| Productos desde JSON local | `data/productos.json` y `js/repo.js` |
| Tarjetas con imagen, descripción, precio y botón | Plantilla en `catalogo.html` y renderizado en `js/view.js` |
| Añadir, eliminar y actualizar cantidades | `js/cart.js` y eventos en `js/app.js` |
| Subtotal y total dinámicos | Cálculos en centavos en `js/cart.js` |
| Al menos tres mecanismos de persistencia | `js/storage.js`: localStorage, IndexedDB y cookies |
| Marca de última actualización | Fecha del carrito y de la caché del catálogo |
| Validaciones con regex y errores accesibles | `js/validation.js` y `js/form.js`: `aria-invalid` y `aria-describedby` |
| Accesibilidad y teclado | Enlace al contenido, textos alternativos, foco visible, diálogo y regiones live |
| Ejecución local y por Internet | Apertura directa de `index.html`, Neocities y GitHub Pages |
| Documentación | Este README y las [revisiones técnicas](docs/auditorias/) |

## Uso

1. Descomprime la entrega conservando las carpetas.
2. Abre `index.html` en un navegador actual (Chrome, Edge, Firefox o Brave).
3. Entra en **Productos**, añade artículos y abre **Carrito**.
4. Cambia cantidades, elimina productos y recarga para comprobar la persistencia.
5. En el carrito, escribe el nombre, teléfono y dirección del comprador para preparar el pedido. No necesitas crear una cuenta; al confirmar, WhatsApp abre el mensaje para que lo revises y lo envíes.
6. Abre la portada y el catálogo al menos una vez con internet desde GitHub Pages. Después puedes recargar y recorrer el sitio sin conexión; el pedido quedará guardado hasta que vuelvas a tener internet para enviarlo por WhatsApp.
7. Al añadir productos, cambiar cantidades, confirmar una eliminación o vaciar el carrito, el navegador descarga automáticamente `carrito-reina-del-cisne.json`. Puedes abrir el archivo en VS Code o en un editor de texto para mostrar la selección.

No necesita instalación, servidor dinámico ni backend. Imágenes, estilos, fuentes y scripts están incluidos. El uso offline con el service worker requiere HTTPS (como GitHub Pages) y una primera visita con internet. Si abres directamente los archivos con `file://`, el carrito se guarda, pero el navegador no permite instalar el service worker. WhatsApp, redes y Google Maps necesitan Internet.

## Entrega en ZIP

Desde la raíz del proyecto, ejecuta en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/crear-entrega.ps1
```

Se genera `entrega/Reto1_Olmedo_Elkin.zip` con las páginas, `assets/`, `data/`, `js/`, README, documentación, scripts y pruebas. El ZIP contiene `index.html` en su raíz: descomprímelo y ábrelo para utilizar el sitio. Puedes personalizar el nombre con `-Nombre Reto1_Apellido_Nombre.zip`. La carpeta `entrega/` queda excluida de GitHub mediante `.gitignore`; sube el ZIP al aula virtual.

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

GitHub Pages publica la rama `main` mediante `.github/workflows/pages.yml`. En GitHub, `index.html`, `README.md`, `assets/`, `data/` y `js/` deben verse directamente en la raíz, como en el árbol anterior. Para Neocities, sube `index.html`, `catalogo.html`, `robots.txt`, `service-worker.js` y las carpetas `assets`, `data` y `js` conservando las rutas. No subas el ZIP como sustituto de los archivos de la web.

Sitios: [Neocities](https://proyecto01.neocities.org/) y [GitHub Pages](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/).

Bootstrap Grid 5.3.3 (MIT), DM Sans y Fraunces (Google Fonts); fotografías generales de Unsplash. Logo, fotografía de la fachada e imágenes de Eucerin y Pigeon proporcionados para el proyecto. La paleta combina fondos crema, tarjetas blancas y detalles rojos; el pie utiliza rojo vino con textos y logo en crema, sin recuadro alrededor del PNG transparente.
