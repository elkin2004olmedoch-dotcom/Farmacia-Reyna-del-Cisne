# Auditoría 01 — Estructura HTML e index

**Fecha:** 5 de octubre de 2026.
**Alcance:** `index.html`, `catalogo.html` y organización de los scripts.

## Cambios realizados

- Se organizó la portada en presentación, servicios, ubicación, preguntas frecuentes y formulario de contacto.
- `index.html` es el archivo principal que abre el sitio; `catalogo.html` contiene los productos, filtros y carrito.
- Se utilizó HTML5 con idioma español, codificación UTF-8 y etiqueta viewport para adaptar la página al dispositivo.
- La estructura emplea `header`, `nav`, `main`, `section` y `footer`, con títulos y enlaces que identifican cada sección.
- Los scripts se cargan con `defer`: esperan a que se analice el HTML y conservan su orden de ejecución.
- El código comparte funciones mediante `globalThis.Farmacia`; cada archivo encapsula sus variables en una función.
- Se reemplazó la fotografía de las manos en la portada por la fachada real proporcionada para el proyecto.

## Errores

- La comprobación de recursos locales no detectó rutas faltantes en los archivos revisados.
- El catálogo dinámico, el carrito y la validación personalizada necesitan JavaScript habilitado.
- La aplicación comprueba si existe la cuadrícula del catálogo antes de inicializarla, evitando buscarla en la portada.
- La página es estática: el formulario no envía información a un servidor propio ni existe un sistema de pagos.

## Resultado

- El visitante entra por `index.html` y accede al catálogo mediante la navegación del sitio.
- La separación de páginas permite presentar la farmacia y organizar la compra sin concentrar todo en la portada.
- Los archivos JavaScript clásicos permiten usar la copia local del catálogo al abrir los HTML desde una carpeta.
- La nueva fachada conserva su proporción completa y el texto queda debajo para no ocultar los letreros.
- Para la defensa: usamos `index.html` como entrada; su nombre no significa que exista un índice de base de datos.

## Lo que falta

- Confirmar con la farmacia los horarios, dirección, teléfono y vigencia de la información comercial publicada.
- Revisar los enlaces de navegación después de subir los archivos al alojamiento definitivo.
- Si se requiere una venta real, definir un backend para pedidos, inventario y pagos; actualmente no están implementados.
- Conservar las rutas relativas al mover el proyecto para que CSS, JavaScript e imágenes sigan cargando.
