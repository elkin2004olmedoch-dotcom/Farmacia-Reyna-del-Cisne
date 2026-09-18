# Auditoría de catálogo separado — 18 de septiembre de 2026

## Mejoras realizadas

- Se retiró el catálogo de la página principal para evitar una portada amontonada.
- Se creó `catalogo.html` como una ventana/página independiente enlazada desde el menú.
- La nueva página tiene una estructura de tienda visual:
  - Encabezado propio.
  - Enlace para regresar al inicio.
  - Mensaje introductorio del catálogo.
  - Buscador visual preparado para una futura implementación.
  - Filtros por categoría.
  - Tarjetas de productos con imagen, categoría, descripción, precio y acción.
  - Carrito lateral CSS-only.
- Se mantuvo la paleta propia de Farmacia Reyna del Cisne y el Grid System de Bootstrap.
- Se conservaron las imágenes con texto alternativo.
- La selección múltiple y el carrito siguen funcionando sin JavaScript.

## Verificación

- En móvil de 390 px no se detectó desbordamiento horizontal.
- La categoría “Cuidado personal” filtra los productos correctamente.
- El producto seleccionado aparece en el carrito lateral.

## Pendientes

- Convertir el buscador visual en búsqueda real cuando se incorpore JavaScript.
- Calcular totales y cantidades dinámicamente.
- Reemplazar imágenes externas por imágenes propias o autorizadas.
- Sustituir precios y productos de demostración por el inventario real.
