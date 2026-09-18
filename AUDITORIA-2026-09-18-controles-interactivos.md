# Auditoría de controles interactivos del catálogo — 18 de septiembre de 2026

## Cambios

- “Filtrar por” ahora contiene opciones visibles de precio:
  - Todos los precios.
  - Menos de $10.
  - $10 a $15.
  - Más de $15.
- Los filtros de precio ocultan y muestran las tarjetas correspondientes usando HTML y CSS.
- Las categorías existentes siguen funcionando y se pueden combinar con el filtro de precio.
- “Ordenar” ahora abre un menú con:
  - Recomendados.
  - Precio: menor a mayor.
  - Precio: mayor a menor.
- El orden cambia visualmente las tarjetas sin JavaScript.
- El buscador ahora es un control HTML de tipo búsqueda con sugerencias de productos mediante `datalist`.
- La disponibilidad se muestra dentro de un panel desplegable.

## Verificación

- El filtro “Menos de $10” muestra únicamente Protector solar.
- El orden “Precio: menor a mayor” coloca Protector solar antes de Vitaminas diarias, Cuidado del bebé y Botiquín básico.
- Las cuatro tarjetas vuelven a mostrarse al seleccionar “Todos los precios” y “Todos”.
- No se añadieron eventos JavaScript: la selección de productos y el carrito siguen siendo CSS-only.
- No hay errores de sintaxis ni desbordamiento horizontal en móvil.

## Alcance actual

Las sugerencias del buscador son interactivas, pero el filtrado por texto libre requerirá JavaScript cuando se habilite esa etapa del proyecto.
