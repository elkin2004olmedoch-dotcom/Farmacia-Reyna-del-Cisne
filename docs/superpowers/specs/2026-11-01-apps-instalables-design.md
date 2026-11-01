# Apps instalables y repositorio privado

El propietario eligió tienda instalable para clientes Android/iPhone, reparto separado y PWA administrativa para Windows (no .exe). Mantener HTML/CSS/JS, Express y Prisma 6, logo/colores/mascotas, servicios actuales y plan Free. No modificar persistencia ni pagos.

## Enfoque y límites

PWA sobre las vistas y API existentes, con manifiestos de identidad distintos para tienda y administración, inicio standalone e iconos derivados del logo. Se descarta duplicar la app en Electron o reescribir frontend: no hace falta otra tecnología para el acceso Windows solicitado. La app nativa de reparto sigue separada porque la PWA no garantiza GPS bloqueado. iOS tienda se añade desde Compartir; no presentar enlaces App Store ni IPA inexistentes.

Botón visible «Obtener app» en cabecera, dialog accesible con opciones Android/iPhone y sección de reparto. Prompt nativo solo por gesto y cuando el navegador lo ofrece; instrucciones claras en otros casos, cancelación sin afirmar instalación. La instalación administrativa se ofrece desde panel y página `instalar-admin.html`, tras comprobar sesión admin; usa la misma API autenticada y BD. El manifiesto no otorga permisos.

Service worker nuevo de la aplicación MVC: almacena únicamente una página genérica sin conexión. Nunca cachea API, datos, respuestas autenticadas, documentos, coordenadas ni páginas de administración. Mantener el service worker histórico separado. No se introduce modo de transacciones sin red.

Descarga nativa Android en `/descargas/reparto-0.1.0.apk`, mismo APK firmado y hash verificados, más suma pública. Incluir explícitamente en Pages y Express estático con MIME/descarga apropiados. El build de Pages conserva whitelist, CSP y límites.

## Contratos

`frontend/controllers/install.js`: exporta `installController()` (idempotente, inicialización temprana de prompt y SW) y `adminInstallController()` (requireUser admin antes de habilitar instalación). App bootstrap añade ruta `admin-install` y llama installController antes de esperar API.

HTML: `[data-app-open]` abre `#app-install-dialog`; `#app-install-close` cierra; `[data-install-platform="android"|"ios"|"windows"]` muestra guía `#install-guidance` (role=status); `#app-install-action` inicia prompt si disponible. `#admin-install-action` instala administración cuando rol admin y prompt disponible; `#admin-install-status` ofrece guía y estado. Links de reparto son estáticos, iPhone nativo pendiente y sin falsa descarga.

Manifiestos `store.webmanifest` y `admin.webmanifest`: id distintos, scope raíz, start_url tienda `/` y admin `/admin.html?app=administracion`, display standalone, theme vino y logo/iconos 192/512. Apple touch 180. `frontend/app-worker.js` y `frontend/offline.html` gestionan exclusivamente fallback genérico.

## Publicación y privacidad

Tras pruebas, publicar Pages por la rama real `codex/separacion-cloudflare`, y backend en Render existente preservando Free/Auto-Deploy Off. Publicar/verificar APK en dominio propio antes de privatizar. Confirmar permisos Git de integraciones y verificar tras cambio. GitHub Pages histórico se despublicará en Free; la tienda principal sigue Cloudflare. No contratar cuentas ni servicios. Fuente privada no retracta copias anteriores ni oculta JS público necesario en el navegador.

## Aceptación

Pruebas prompt aceptado/cancelado, iOS/manual/no soporte, instalado, teclado/Escape/foco y móvil; admin/no admin y JWT backend conservados. Manifiestos válidos/identidad independiente, SW nunca intercepta API/cache sensible, Pages contiene todos los artefactos y descarga SHA idéntica. Regresiones de cabeceras/carrito/mascotas/auth y despliegue. No afirmar instalación física iOS/Android ni GPS por estas pruebas.
