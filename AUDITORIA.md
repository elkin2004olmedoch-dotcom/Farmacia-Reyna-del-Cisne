# Auditoría breve — Reto 1

Fecha: 2 de octubre de 2026. Proyecto: Farmacia Reyna del Cisne.

## Comprobado

- HTML semántico y carpetas `assets`, `data`, `js`.
- Productos desde JSON, tarjetas reutilizables y recursos locales.
- Carrito: añadir, quitar, cambiar cantidades, vaciar, subtotal y total.
- Persistencia: localStorage, sessionStorage, IndexedDB y cookie; fecha de actualización y migración del carrito anterior.
- Formulario con regex, mensajes accesibles y consulta por WhatsApp.
- Diálogo con teclado/Escape, foco al quitar/vaciar, filtros nativos y errores enlazados; confirmación visible y anunciada.
- 11 pruebas automatizadas aprobadas; carrito, recarga, teclado y formulario verificados en navegador.
- Sin desbordamiento horizontal en anchos de 320, 390, 768, 1024 y 1440 píxeles.
- Axe 4.10.3: sin infracciones automáticas detectadas en los estados revisados; árbol de accesibilidad comprobado.
- Apertura directa `file://` sin Internet: catálogo, imágenes y carrito funcionan.
- Neocities publicado: portada, JSON, 4 productos, carrito persistente e imágenes comprobados sin errores de JavaScript.

## Observaciones importantes

- Productos, precios y horarios de demostración. Instagram y Facebook abren las páginas generales, según lo solicitado.
- WhatsApp y mapa necesitan Internet. El formulario prepara el mensaje; no lo envía automáticamente.
- Regenerar `productos-local.js` al cambiar el JSON.
- Pendiente: prueba real con lectores de pantalla y usuarios ciegos; mapa externo fuera de la comprobación automática.

Las auditorías anteriores se consolidaron aquí para evitar información repetida o desactualizada.
