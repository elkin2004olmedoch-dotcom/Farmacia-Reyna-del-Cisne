# Auditoría 09 — Pruebas, entrega y publicación

**Fecha:** 5 de octubre de 2026.
**Alcance:** verificaciones locales, documentación, recursos y paquete de entrega.

## Cambios realizados

- Se organizaron nueve auditorías por tema para explicar el proyecto durante la defensa.
- Cada una documenta cambios realizados, errores o límites, resultado y trabajo pendiente.
- Se incorporaron el logo, las imágenes de Eucerin y Pigeon y la fachada proporcionados para el proyecto, con una paleta suave de fondos neutros y rojo como acento.
- La entrega incluye HTML, CSS, JavaScript, productos, recursos locales, pruebas y documentación.
- Los precios y el inventario siguen siendo datos de demostración, sujetos a confirmación comercial.
- El proyecto conserva un flujo de GitHub Pages y las instrucciones de carga de archivos en Neocities.
- Los recursos locales permiten presentar el catálogo sin depender de una CDN; mapa y WhatsApp requieren conexión.

## Errores

- La ejecución local aprobó las 11 pruebas de recursos, lógica del reto y almacenamiento, sin fallos.
- Los recorridos de accesibilidad y teclado también finalizaron correctamente.
- La fachada cargó a 390 y 1440 píxeles sin desbordamiento horizontal ni errores JavaScript en las pantallas revisadas.
- Las comprobaciones corresponden a los archivos locales: los sitios publicados no se verificaron con esta última edición.
- El nombre antiguo dentro de la URL de GitHub Pages se conserva porque identifica el repositorio existente.

## Resultado

- La versión revisada permite presentar la farmacia, buscar productos, usar el carrito y preparar una consulta.
- La verificación Node se ejecutó con `node --test tests/resources.test.cjs tests/reto.test.cjs tests/storage.test.cjs`.
- Las pruebas de navegador cubren cancelación, eliminación, cantidades, filtros, menú móvil y validación del formulario.
- El ZIP de entrega reúne los archivos necesarios y las nueve auditorías ampliadas.
- Para la defensa: explicar qué se probó y qué sigue siendo una demostración evita presentar pagos o inventario real como implementados.

## Lo que falta

- Publicar esta versión si debe verse en Neocities o GitHub Pages y comprobar después sus rutas y recursos.
- Para Neocities, subir los archivos de la web conservando sus carpetas; el ZIP no sustituye esos archivos.
- Confirmar datos de contacto, horarios, promociones, precios y disponibilidad con la farmacia.
- Antes de exponer, abrir `index.html` y recorrer catálogo, filtros, carrito y formulario en el equipo de presentación.
- Mantener una copia local de la entrega para demostrar el catálogo si falla la conexión a Internet.
