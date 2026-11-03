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

## Referencias comerciales y procedencia

El catálogo inicial contiene 18 referencias comerciales con empresa o marca y presentación. El titular autorizó elegir referencias reales para sustituir las fichas genéricas; las cuatro ilustraciones de medicamentos sin identificar se sustituyeron por productos de cuidado e insumos, sin inventar registros sanitarios, concentraciones ni PVP impreso. Se mantienen los identificadores de los registros y los pedidos históricos conservan sus datos originales.

El campo «Laboratorio o marca» identifica al fabricante, titular de marca o empresa responsable según la evidencia disponible; no afirma que todas las empresas sean laboratorios farmacéuticos ni identifica una planta industrial no comprobada. [Fuentes por producto](../data/fuentes-productos.json) registra las páginas oficiales, corroboraciones, el papel de cada empresa y la procedencia de las fotografías. Ejemplos: Ensure Advance vainilla de 850 g (Abbott), Eucerin Photoaging Control de 50 ml (Beiersdorf), Corega Tabs de 30 tabletas (Haleon) y el set Pigeon Health Care Set, sin atribuirle un número de piezas no verificado. Las fotos de envases pueden corresponder a una edición regional indicada en el manifiesto.

Los nombres y presentaciones seleccionados no acreditan existencias físicas ni sustituyen la comprobación del envase y lote que haga la farmacia. Los precios y cantidades configurados por el negocio se conservan; no se usan precios de otras tiendas como tarifa comercial. El botiquín PolinPlast es solamente la caja organizadora; Marimer corresponde a un spray para higiene nasal, no a una solución intravenosa.

La carga inicial toma los metadatos de `data/productos.json` únicamente cuando crea el catálogo en una base vacía. Reejecutar el seed no sobreescribe productos existentes. Para el catálogo publicado se usa la API administrativa con respaldo previo y control de versión (`esperadoUpdatedAt`), preservando precio base, stock, descuentos, IVA y restricciones. No se requieren cambios de esquema ni migraciones nuevas. La copia histórica `data/productos-local.js` se regenera con `node scripts/build-data.cjs`.

`catalog-metadata.test.cjs` comprueba datos, recursos, carga inicial, facetas y conservación de ediciones en SQLite temporal. `catalog-metadata.spec.cjs` verifica filtros combinados, ficha, teclado, accesibilidad y que las fotos entren completas en las tarjetas a 320, 375, 768 y 1440 píxeles.

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
