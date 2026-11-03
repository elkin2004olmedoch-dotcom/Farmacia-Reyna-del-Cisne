# Catálogo y búsqueda

La tienda conserva sus colores vino, rojo y crema, logos y mascota Goti. Esta entrega mejora el catálogo, el buscador y la ficha sin cambiar la tecnología ni el esquema de datos.

## Recorrido

1. Escribe al menos dos caracteres en la cabecera o en el catálogo. Las sugerencias muestran imagen, nombre, precio y presentación/laboratorio cuando están registrados.
2. Usa flechas para seleccionar, Enter para abrir y Escape para cerrar conservando el texto. Enter sin selección busca en el catálogo. También puedes pulsar una sugerencia.
3. Las coincidencias aproximadas se identifican expresamente; revisa nombre y presentación antes de elegir. No se cambian productos ni se añaden al carrito automáticamente.
4. Filtra por categoría, laboratorio y presentación. Los dos últimos aparecen cuando el catálogo tiene esos datos. Ordenar por precio usa el precio final vigente, incluidas las promociones permitidas.
5. Navega entre páginas de 24 productos. La URL conserva filtros, página y orden al recargar o compartir; comparar conserva la selección entre páginas.
6. Abre la ficha para ampliar la imagen, revisar datos técnicos, ajustar cantidad y añadir al carrito. Las restricciones de receta, control especial, biológicos y frío mantienen la atención profesional.

Si falta una foto, se muestra «Imagen no disponible». No se inventan envases, laboratorios, registros, opiniones ni indicaciones médicas. La ficha informa que la tarifa se confirma con la dirección; el checkout mantiene el cálculo vigente del negocio.

Los errores de carga permiten reintentar. Las respuestas antiguas se cancelan y no sustituyen una búsqueda nueva. Volver a una página restaurada recupera la carga pendiente; los paginadores conservan el foco del teclado.

## API y responsabilidades

| Ruta GET | Respuesta / parámetros |
| --- | --- |
| `/api/productos` | `items`, `total`, `page`, `pageSize`; `q`, `categoria`, `laboratorio`, `presentacion`, `sort= recommended/low/high` |
| `/api/productos/sugerencias?q=…` | `items` (máximo seis), `aproximadas`; admite los filtros de categoría y metadatos |
| `/api/productos/filtros` | `laboratorios` y `presentaciones` de productos activos, agrupados en la base |
| `/api/productos/:id` | Ficha y precio/stock vigentes |

Se conserva el contrato público anterior y el tamaño predeterminado de API (50); el catálogo solicita 24. El controlador de página consulta la API, la vista escapa los datos y el modelo backend reutiliza las reglas existentes de precio, IVA, promociones y lotes. El carrito vuelve a consultar el producto antes de añadirlo.

Las consultas SQL de texto se parametrizan con Prisma 6 y tratan `%` y `_` como caracteres literales. Se validan tipos, longitudes, orden y páginas; se rechazan filtros ambiguos o repetidos. La normalización española funciona en SQLite y PostgreSQL sin extensiones. No cambian autenticación, permisos, CORS, cookies ni límites de intentos.

## Verificación y rendimiento

Pruebas nuevas: `catalog-search.test.cjs` (API/SQLite y PostgreSQL temporal), `catalog-views.test.cjs` (metadatos, escape y restricciones) y `catalog-discovery.spec.cjs` (teclado, sugerencias, filtros, paginación, errores, imágenes y restauración). Se mantienen los recorridos de carrito, compra, administración, mascotas y reparto, además de las comprobaciones del artefacto de Pages.

Medición local con 1.000 productos sintéticos y siete muestras calientes por proveedor, mediante Supertest:

| Operación | JSON / HTTP | SQLite, mediana | PostgreSQL 18, mediana |
| --- | --- | --- | --- |
| Cargar todo, diez páginas de 100 | 886.930 bytes / 10 | 305,25 ms | 304,20 ms |
| Cargar una página de 24 | 21.261 bytes / 1 | 14,98 ms | 20,79 ms |
| Buscar, página de 24 | — / 1 | 53,79 ms | 62,59 ms |
| Ordenar por precio final | — / 1 | 46,46 ms | 57,42 ms |
| Sugerencia exacta | — / 1 | 27,92 ms | 36,46 ms |

La página inicial añade una consulta de facetas (426 bytes en ese conjunto). La reducción de JSON del listado es 97,6 % en ese escenario; no representa tiempos de producción ni arranques en frío de Render.

Límites: el texto normalizado requiere examinar candidatos activos; el orden de precio calcula una proyección ligera de las coincidencias antes de cargar los detalles de la página. Las aproximaciones consideran hasta 200 candidatos con el mismo prefijo de dos letras y pueden omitir alternativas posteriores. Si crece el catálogo, medir consultas reales antes de introducir búsqueda indexada específica de PostgreSQL. No se añaden índices ni dependencias sin evidencia.
