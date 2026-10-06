# Auditoría 02 — Diseño, identidad y adaptación responsive

**Fecha:** 5 de octubre de 2026.
**Alcance:** estilos de portada y catálogo, logo e imágenes del proyecto.

## Cambios realizados

- Se unificaron los componentes con la identidad del nuevo logo, un fondo crema cálido y detalles rojos; el pie utiliza rojo vino con textos claros.
- Las variables CSS centralizan los colores, tipografías y superficies; promociones y contacto usan crema suave, y el pie recupera la distribución anterior sobre rojo oscuro.
- La portada utiliza Bootstrap Grid 5.3.3 local para distribuir columnas; los estilos propios completan el diseño.
- El catálogo usa CSS Grid y Flexbox para organizar tarjetas, filtros y resumen del carrito.
- Se mantienen las fuentes DM Sans y Fraunces y los recursos locales para no depender de una CDN durante la exposición.
- Se incorporaron las fotografías entregadas del protector Eucerin FPS 50 y del set de cuidado Pigeon.
- Las fotos de esos productos usan `object-fit: contain` para mostrar el envase completo.
- La fachada real sustituye la imagen genérica de las manos y conserva su relación de aspecto.

## Errores

- Se corrigió el contraste de textos secundarios sobre fondos rojos, usando blanco en los bloques afectados.
- La revisión automática de contraste no encontró incumplimientos en portada, catálogo y diálogos comprobados a 390 y 1440 píxeles.
- La herramienta dejó casos para revisión manual en fondos con trama e iconos; esta prueba no equivale a una certificación completa.
- La inspección de esos dos tamaños no detectó desbordamiento horizontal ni errores JavaScript.
- Estas comprobaciones corresponden al navegador de prueba; no demuestran compatibilidad con todos los dispositivos.

## Resultado

- La página conserva la marca en el logo y las acciones principales, con superficies claras y títulos oscuros que reducen la saturación visual.
- El logo conserva su rojo original en la cabecera; en el pie se presenta en crema mediante CSS, aprovechando la transparencia del PNG sin recuadro.
- En móvil se reorganiza la distribución y el menú permite acceder a las mismas secciones.
- La foto de la fachada se ve completa, con el mensaje de la portada debajo de ella.
- Para la defensa: Bootstrap se utiliza como cuadrícula; la identidad visual y los demás ajustes se implementan con CSS propio.

## Lo que falta

- Comprobar la presentación en teléfonos físicos y en otros navegadores antes de una entrega comercial.
- Revisar el peso de las fotografías si se busca mejorar la carga con conexiones lentas.
- Confirmar la vigencia de las promociones que aparecen dentro de la foto de la fachada.
- Mantener los colores centralizados al añadir nuevas secciones para conservar la uniformidad del sitio.
