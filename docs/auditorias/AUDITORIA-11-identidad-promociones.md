# Identidad y promociones

Se restituye la fachada de Farmacia Reina del Cisne en la portada y la paleta crema, rojo y vino en las ocho pantallas. Se conservan las funciones de tienda y los 18 productos de la versión publicada, con sus ilustraciones. También se conserva la validación del almacenamiento y catálogo de esa versión y se elimina la descarga automática del carrito.

Las promociones se leen desde JSON independiente del HTML. Cada campaña tiene estado de publicación, orden y vigencia opcional con zona horaria. Se ocultan campañas inactivas, futuras, vencidas o con datos incorrectos. Hay dos ejemplos etiquetados como vista previa; no anuncian descuentos reales. Una lista vacía muestra próximas novedades. Se incluye copia local y caché offline.

El futuro administrador podrá guardar campañas en base de datos y reemplazar el método de carga por una API. No se implementa aún autenticación administrativa ni base de datos.

Verificación: 29 pruebas Node, incluidas las comprobaciones de entradas y almacenamiento de la versión publicada; compra completa en escritorio y móvil; revisión de las ocho páginas a 320, 375 y 1440 px; campañas y estado vacío; respaldo local y accesibilidad automática con axe-core. Se corrige el contraste del importe en el carrito con el nuevo fondo vino.
