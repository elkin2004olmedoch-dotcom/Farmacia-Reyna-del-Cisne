# Auditoría visual y responsive — 18 de septiembre de 2026

## Alcance

Se revisó la integración de Bootstrap Grid, la adaptación para pantallas pequeñas y la personalización visual de la página de Farmacia Reyna del Cisne.

## Mejoras realizadas

- Se confirmó que Bootstrap se usa únicamente como sistema de columnas (`row`, `col-*` y utilidades de alineación); no se usan componentes visuales predeterminados de Bootstrap.
- Se reforzó el enfoque mobile-first con estilos base para teléfonos y un breakpoint específico para pantallas de hasta 680 px.
- Se ajustó el encabezado móvil: logo flexible, menú desplegable y acciones secundarias ocultas cuando no hay espacio suficiente.
- Se hicieron de ancho completo los botones principales en móvil para mejorar el uso táctil.
- Se reorganizaron accesos rápidos, proceso de atención, tarjetas promocionales, mapa, contacto y pie de página para evitar desbordamientos horizontales.
- Se definió una paleta propia de marca:
  - Azul petróleo `#174A5B` para confianza y acciones principales.
  - Azul tinta `#17324D` para textos.
  - Coral `#ED735D` para llamadas visuales.
  - Crema `#FFF8ED` como fondo cálido.
  - Verde suave `#DFF0E9` y amarillo `#F5C86A` como acentos.
- Se reemplazaron fondos azul grisáceos repetitivos por variables de la paleta para que la interfaz no dependa de valores genéricos.
- Se mantuvo la auditoría histórica intacta y se creó este archivo independiente.

## Pendientes

- Sustituir las fotografías de Unsplash por fotografías propias o autorizadas de la farmacia.
- Reemplazar los datos de muestra de contacto, horario y dirección por información confirmada.
- Verificar el diseño en dispositivos físicos y en navegadores distintos.
- Comprobar contraste de todos los estados hover y focus con una herramienta de accesibilidad.
- Configurar una política de imágenes y una estrategia de respaldo si el CDN externo no está disponible.

## Resultado

La página conserva el Grid System solicitado, pero la apariencia queda controlada por CSS propio. La estructura prioriza móvil y escala progresivamente hacia tablet y escritorio.
