# Auditoría 03 — Catálogo, JavaScript y datos JSON

**Fecha:** 5 de octubre de 2026.
**Alcance:** `data/productos.json`, copia local del catálogo y módulos JavaScript.

## Cambios realizados

- Los cuatro productos de demostración se mantienen en un archivo JSON, separados de la presentación HTML.
- Cada producto contiene un identificador, nombre, descripción, categoría, precio, ruta de imagen y texto alternativo.
- Se actualizaron las fichas de Eucerin y Pigeon para que nombres, descripciones e imágenes correspondan a los productos mostrados.
- `repo.js` carga y valida los datos; `view.js` crea la presentación; `app.js` coordina el estado y los eventos.
- Por HTTP se intenta obtener el JSON mediante `fetch`; si falla, se intenta recuperar la caché válida de IndexedDB.
- Si no hay caché disponible, se utiliza la copia local de productos incluida en el proyecto.
- En `file://` se usa directamente esa copia, evitando depender de una petición al archivo JSON.
- `node scripts/build-data.cjs` regenera `data/productos-local.js` a partir del JSON.

## Errores

- La validación rechaza identificadores repetidos, categorías desconocidas y precios no finitos o fuera del rango admitido.
- También comprueba los textos obligatorios y las rutas de imagen bajo `assets/images` con extensiones permitidas.
- Un fallo de red o una respuesta inválida no debe impedir mostrar el catálogo si existe una copia válida.
- Editar el JSON sin regenerar la copia local puede producir diferencias entre la versión HTTP y la abierta desde una carpeta.

## Resultado

- Los datos válidos se transforman en tarjetas a partir de una plantilla HTML.
- Los nombres y descripciones se colocan con `textContent`, evitando interpretarlos como etiquetas HTML.
- El catálogo puede demostrarse localmente sin instalar paquetes ni disponer de un backend.
- Las pruebas de recursos y lógica del proyecto forman parte de las 11 comprobaciones Node aprobadas.
- Para la defensa: JSON guarda los datos, JavaScript controla el comportamiento y HTML/CSS presentan el contenido.

## Lo que falta

- Regenerar y revisar la copia local cada vez que se modifiquen productos o precios.
- Confirmar precios, disponibilidad y descripciones antes de utilizar el catálogo con clientes.
- Añadir una fuente de inventario real si se necesita actualizar existencias desde un panel administrativo.
- Ampliar las pruebas de recuperación ante fallos de red y cachés antiguas para una versión de producción.
