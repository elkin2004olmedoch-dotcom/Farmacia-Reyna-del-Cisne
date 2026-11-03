# Instalar la farmacia

## Tienda para clientes

Abre [la tienda](https://farmacia-reyna-del-cisne-pruebas.pages.dev/) y pulsa **Instalar aplicación** en el pie de página, dentro de **Tu farmacia**. Conserva catálogo, carrito, pedidos, seguimiento y mascotas de la web. Utiliza el navegador normal del dispositivo: el modo incógnito y los navegadores integrados en otras apps pueden impedir la instalación.

- **Android:** elige Android. Si Chrome ofrece instalación, pulsa **Instalar en este dispositivo** y confirma en el navegador. Si no aparece, sigue la opción de instalar/añadir a pantalla de inicio del menú.
- **iPhone/iPad:** elige iPhone y iPad y sigue la guía: Safari → Compartir → Añadir a pantalla de inicio → Añadir. Es la tienda web instalada; no es una descarga de App Store.

Una solicitud aceptada no se presenta como instalación terminada hasta recibir confirmación del dispositivo. Si una página se abre dentro de otra app de la farmacia, el mensaje explica cómo volver al navegador para instalar la otra por separado. Los [mecanismos y requisitos dependen del navegador y del sistema](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Administración para Windows

Abre [el instalador administrativo](https://farmacia-reyna-del-cisne-pruebas.pages.dev/instalar-admin) en Microsoft Edge o Chrome, fuera de incógnito, e inicia sesión con una cuenta de administrador. También se accede desde **Instalar en Windows** en la cabecera del panel.

Pulsa **Instalar administración en Windows** cuando el navegador ofrezca el permiso de instalación. Si el botón no está disponible, la página muestra los pasos del menú del navegador. Se abre desde su propio icono, en una ventana dedicada, y pide autenticación para acceder al panel. No hay instalador .exe ni una copia local de la base de datos.

Productos, inventario, promociones, pedidos, entregas y Farmi utilizan la misma API Express y la base de datos existentes. El navegador no recibe claves de Supabase ni conexión SQL. La autorización administrativa se valida en el backend; instalar una app o añadir un acceso directo no concede ese rol.

## Reparto independiente

Abre **Instalar aplicación** desde el pie de página de la tienda. En el cuadro de instalación, la sección **Equipo de reparto** enlaza el [APK Android de pruebas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/descargas/reparto-0.2.0.apk) y [su suma de verificación](https://farmacia-reyna-del-cisne-pruebas.pages.dev/descargas/SHA256SUMS.txt), alojados en la propia web. El archivo es el mismo firmado y verificado de la candidata 0.2.0; no depende del acceso público a GitHub.

Requiere una cuenta activa de repartidor. El GPS nativo pertenece a esa app, no a la tienda PWA. La versión nativa de reparto para iPhone continúa pendiente de firma/aprovisionamiento y las pruebas físicas de bloqueo, Maps, batería y red siguen siendo necesarias. Consulta [la guía de reparto](../mobile/README.md).

## Conexión y privacidad

Precios, pedidos, pagos y administración requieren conexión. El worker guarda únicamente una pantalla pública sin conexión; no almacena respuestas de la API, páginas de cuenta/panel, documentos, ubicaciones o pedidos. La instalación no guarda contraseñas. La sesión y sus restricciones siguen las reglas de la aplicación existente.

El proyecto conserva Render Free por decisión del propietario: puede suspenderse por inactividad. No se ofrece disponibilidad 24/7 con ese alojamiento. No se añadieron dependencias, cambios de esquema, servicios de pago ni un framework del Reto 3.

El repositorio contiene código público y ejemplos de configuración. Las claves, accesos de prueba, certificados y respaldos se conservan fuera de Git. Los archivos `.env` y `.publish/` están excluidos: no los subas al repositorio ni los compartas.
