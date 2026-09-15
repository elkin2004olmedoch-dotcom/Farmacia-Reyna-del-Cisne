# Auditoria del sitio web

**Proyecto:** Farmacia Reyna del Cisne  
**Fecha:** 15 de septiembre de 2026  
**Alcance:** `index.html`, `styles.css`, recursos locales y enlaces principales  
**Resultado:** Aprobado con observaciones de contenido y despliegue

## Resumen

La página es una landing page estática desarrollada únicamente con HTML y CSS. La navegación interna, el contacto por WhatsApp, el enlace telefónico, la ubicación y el mapa están integrados. La estructura es responsive y no requiere JavaScript para las interacciones actuales.

## Verificaciones realizadas

- HTML5 con idioma `es` y meta viewport configurado.
- Hoja de estilos enlazada correctamente.
- Logo y favicon locales presentes en el proyecto.
- Navegación principal y menú móvil con enlaces internos.
- Enlaces de WhatsApp actualizados al número `0979275988`.
- Enlace telefónico configurado como `tel:+593979275988`.
- Enlace de ubicación configurado con el mapa proporcionado.
- Mapa embebido mediante Google Maps.
- Tarjetas, botones y accesos rápidos enlazados a secciones relevantes.
- Estados de foco visibles para navegación con teclado.
- Reglas responsive para escritorio, tablet y móvil.
- Página servida localmente y verificada con respuesta HTTP `200`.

## Hallazgos

### Prioridad alta

No se encontraron errores bloqueantes en la revisión estática ni en la carga local.

### Prioridad media

1. **Datos comerciales pendientes de confirmar.** La dirección y el horario aparecen como información de muestra. Deben reemplazarse por los datos definitivos antes de publicar.
2. **Mapa embebido genérico.** El botón externo usa la ubicación proporcionada, pero el `iframe` realiza una búsqueda por nombre. Conviene confirmar que el punto mostrado coincide exactamente con el local.
3. **Dependencias externas.** Las imágenes de Unsplash, Google Fonts y Google Maps requieren conexión a Internet y podrían cambiar, tardar en cargar o aplicar límites del proveedor.

### Prioridad baja

1. Se puede añadir una imagen Open Graph para mejorar la vista previa al compartir el enlace en redes sociales.
2. Se puede incorporar un `canonical` cuando exista un dominio público definitivo.
3. El año del pie de página debería actualizarse al año de publicación final.

## Accesibilidad y experiencia de usuario

- Las imágenes principales tienen texto alternativo.
- El `iframe` del mapa tiene un título descriptivo.
- Los enlaces tienen destinos identificables y los botones principales son accesibles mediante teclado.
- La navegación móvil se mantiene dentro del documento y no depende de JavaScript.
- El encabezado fue ajustado para evitar que la navegación y el botón de contacto se superpongan.
- Se recomienda probar contraste y tamaños de texto en el dispositivo real antes de publicar.

## Seguridad y mantenimiento

- Los enlaces externos que abren una pestaña nueva incluyen `rel="noreferrer"`.
- No se detectaron claves, contraseñas ni datos sensibles en los archivos revisados.
- El proyecto conserva una estructura simple y fácil de mantener.
- Al publicar, conviene usar HTTPS y revisar que el proveedor de hosting sirva correctamente el favicon, el logo y la hoja de estilos.

## Recomendaciones finales

1. Confirmar dirección, horario, servicios reales y textos comerciales.
2. Sustituir las imágenes genéricas por fotografías autorizadas de la farmacia.
3. Validar el punto exacto del mapa en móvil y escritorio.
4. Probar los enlaces de WhatsApp y teléfono desde un celular real.
5. Añadir dominio, imagen social y `canonical` cuando el sitio tenga URL definitiva.

## Dictamen

**Aprobado para revisión del cliente y demostración local.** Antes de una publicación definitiva se deben confirmar los datos del negocio y comprobar las dependencias externas en el entorno de producción.
