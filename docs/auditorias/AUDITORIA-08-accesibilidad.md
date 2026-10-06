# Auditoría 08 — Accesibilidad, teclado y control del foco

**Fecha:** 5 de octubre de 2026.
**Alcance:** portada, catálogo, carrito, navegación y formulario.

## Cambios realizados

- Se incluyó un enlace para saltar al contenido principal y una estructura HTML con regiones reconocibles.
- Los controles utilizan botones, campos y selectores nativos con etiquetas y nombres accesibles.
- Las imágenes cuentan con textos alternativos que identifican su contenido o función.
- Se mantuvo el foco visible para distinguir el control activo durante la navegación con teclado.
- El carrito utiliza `dialog.showModal()`, mantiene el recorrido dentro del diálogo y permite cerrar con Escape.
- Los cambios del carrito y los resultados se anuncian mediante regiones `aria-live`.
- Las categorías admiten flechas, Inicio y Fin; el menú móvil comunica su apertura mediante `aria-expanded`.
- Los estilos respetan la preferencia de movimiento reducido y se corrigieron contrastes sobre fondos rojos.

## Errores

- La eliminación de un producto requiere recolocar el foco porque el botón utilizado desaparece al actualizar la vista.
- Se resolvió enviándolo a otro control del carrito o a “Explorar productos” cuando ya no quedan filas.
- Cancelar o cerrar la confirmación conserva el contenido y devuelve el foco al control que la abrió.
- La revisión automática de contraste a 390 y 1440 píxeles no detectó fallos en las pantallas comprobadas.
- No se ha realizado una sesión real con NVDA, JAWS, VoiceOver ni con usuarios ciegos.

## Resultado

- `tests/accesibilidad.browser.cjs` aprobó el recorrido de diálogo, cantidades, filtros y errores del formulario.
- `tests/teclado.browser.cjs` aprobó los recorridos en anchos de 1280 y 375 píxeles.
- Ese recorrido utiliza Tab, Mayús+Tab, Enter, Espacio, Escape y las teclas de navegación de categorías.
- Se comprobaron también el menú móvil y las preguntas frecuentes usando teclado.
- Para la defensa: estas evidencias validan los recorridos probados; no son una certificación de accesibilidad universal.

## Lo que falta

- Realizar pruebas con lectores de pantalla reales para comprobar anuncios, orden y comprensión del contenido.
- Revisar el mapa externo de manera independiente; se ofrece un enlace directo como alternativa.
- Ampliar la revisión a otros navegadores y a usuarios con necesidades de acceso distintas.
- Repetir las comprobaciones si se añaden nuevos controles, diálogos o cambios importantes de color.
