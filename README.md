# Farmacia Reyna del Cisne

Sitio estático del Reto 1: catálogo y carrito con cantidades, filtros, subtotal, total, persistencia y formulario accesible. Los productos y precios son de demostración; el pedido se consulta por WhatsApp.

## Uso

1. Descomprime la entrega conservando las carpetas.
2. Abre `index.html` en un navegador actual (Chrome, Edge, Firefox o Brave).
3. Entra en **Productos**, añade artículos y abre **Carrito**.
4. Cambia cantidades, elimina productos y recarga para comprobar la persistencia.
5. En la portada, completa **Prepara tu consulta**. Una consulta válida habilita el enlace para enviarla por WhatsApp.

No necesita instalación, servidor dinámico ni backend. Imágenes, estilos, fuentes y scripts están incluidos. WhatsApp, redes y Google Maps necesitan Internet.

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
  form.js                  Errores accesibles y consulta
scripts/build-data.cjs      Genera la copia local del JSON
tests/                     Pruebas con Node.js
AUDITORIA.md                Verificación breve
```

## Explicación técnica

JavaScript ES6+ dividido en módulos encapsulados mediante `Farmacia`. Se utilizan scripts clásicos con `defer` para permitir la apertura `file://`, sin los bloqueos que pueden tener los imports ES Modules en ese modo.

En HTTP/HTTPS, `repo.js` carga `data/productos.json` con `fetch`. Al abrir el HTML directamente utiliza `productos-local.js`, generado desde el mismo JSON. Para editar productos, modifica el JSON y ejecuta `node scripts/build-data.cjs`; ambas versiones deben mantenerse iguales.

El carrito admite de 1 a 99 unidades por producto. Calcula importes en centavos para evitar errores decimales. Subtotal y total coinciden porque la demostración no añade recargos; la farmacia confirma el importe final.

## Persistencia

| Mecanismo | Información guardada |
|---|---|
| localStorage | Carrito, cantidades y fecha ISO de actualización |
| sessionStorage | Búsqueda, categoría, filtro de precio y orden de esta sesión |
| IndexedDB | Caché del catálogo y su fecha de actualización |
| Cookie `farmacia-sort` | Orden preferido durante 30 días; SameSite=Lax y Secure en HTTPS |

La selección antigua se migra a cantidades. Datos corruptos o productos retirados se descartan. Si se bloquea el almacenamiento, se informa y el carrito funciona temporalmente. Las cookies pueden estar limitadas en `file://`; ese modo utiliza los otros tres mecanismos. Los datos personales del formulario no se guardan.

## Accesibilidad

HTML semántico, enlace para saltar al contenido, textos alternativos, foco visible y controles nativos. El carrito usa `dialog`: mantiene el foco dentro, se cierra con Escape y devuelve el foco al botón de apertura. Las categorías admiten flechas, Inicio y Fin. Los errores usan `aria-invalid` y `aria-describedby`; cambios y resultados se anuncian con regiones live. El menú móvil utiliza `aria-expanded` y se respeta movimiento reducido.

El catálogo reúne búsqueda, precio y orden arriba; las tarjetas indican las unidades añadidas y un resumen permite abrir el carrito. Al quitar un producto, el foco pasa al siguiente; al vaciarlo, pasa a **Explorar productos**. Los errores del formulario enlazan con cada campo. Usa Tab/Mayús+Tab para recorrer controles y Enter/Espacio para activar botones.

Se comprobaron el árbol de accesibilidad del navegador, teclado, anchos de 320 a 1440 píxeles y axe-core 4.10.3 en portada, formulario y carrito. No se ha realizado una sesión real con NVDA/JAWS/VoiceOver ni con usuarios ciegos; las pruebas automáticas no son una certificación de accesibilidad universal. El mapa externo requiere una revisión independiente; existe un enlace directo como alternativa.

## Pruebas y publicación

Con Node.js: `node --test tests/*.test.cjs`. No requiere instalar paquetes.

GitHub Pages publica la rama `main`. Para Neocities, sube `index.html`, `catalogo.html`, `robots.txt` y las carpetas `assets`, `data` y `js` conservando las rutas. No subas el ZIP como sustituto de los archivos de la web.

Sitios: [Neocities](https://proyecto01.neocities.org/) y [GitHub Pages](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/).

Bootstrap Grid 5.3.3 (MIT), DM Sans y Fraunces (Google Fonts); fotografías de referencia de Unsplash y logo proporcionado para el proyecto.
