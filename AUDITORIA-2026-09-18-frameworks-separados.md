# Auditoría de frameworks separados — 18 de septiembre de 2026

## Decisión aplicada

- `index.html` usa Bootstrap Grid para la página institucional.
- `catalogo.html` usa Tailwind CSS para la pestaña de compras.
- No se cargan Bootstrap y Tailwind dentro de la misma página.

## Mejoras realizadas

- Se eliminó el enlace de Bootstrap de `catalogo.html`.
- Se añadió Tailwind mediante su CDN en `catalogo.html`.
- Se aplicaron clases utilitarias de Tailwind al contenedor del catálogo, toolbar, grid responsive, tarjetas y panel del carrito.
- El grid de productos de compras ahora está controlado por clases Tailwind (`grid-cols-1`, `sm:grid-cols-2`, `xl:grid-cols-4`).
- Se retiraron las reglas CSS propias que definían las columnas del grid del catálogo para evitar mezclar responsabilidades.
- Bootstrap Grid se conserva únicamente en `index.html`, donde ya se usa para hero, servicios, promociones y ubicación.

## Verificación

- `index.html` contiene `bootstrap-grid.min.css` y no contiene Tailwind.
- `catalogo.html` contiene `tailwindcss.com` y no contiene Bootstrap.
- La página de compras conserva filtros, selección CSS-only y carrito.
- El catálogo continúa adaptándose a móvil.

## Pendiente

- Cuando se configure un build de producción, conviene instalar Tailwind localmente y compilar solo las clases utilizadas en lugar de depender del CDN.
