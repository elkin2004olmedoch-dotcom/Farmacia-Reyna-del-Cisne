# Instalación y verificación de la farmacia

La [tienda publicada](https://farmacia-reyna-del-cisne-pruebas.pages.dev/) incorpora Obtener app para clientes Android/iPhone. La [administración para Windows](https://farmacia-reyna-del-cisne-pruebas.pages.dev/instalar-admin) reutiliza la misma API y base de datos, con acceso administrativo. El reparto Android se descarga aparte desde el dominio propio. [Guía de instalación](APPS-E-INSTALACION.md).

## Pruebas de la versión funcional

El [CI 41367361651](https://github.com/elkin2004olmedoch-dotcom/Farmacia-Reyna-del-Cisne/actions/runs/41367361651) del commit 1b0803d0fb7f8b24cf734cc706540ad9c52686a8 aprobó:

- 313/313 Node con SQLite/PostgreSQL temporales y cero omisiones.
- 138/138 recorridos de navegador en escritorio y móvil.
- 22/22 comprobaciones de frontend/API en dominios separados.
- 38 pruebas históricas, 16 casos móviles en PostgreSQL temporal y npm audit.

Las pruebas cubren carrito con imágenes, tarifa modificable y cambio de cotización, pedidos, permisos, seguimiento, mapa voluntario y órdenes de Farmi. Se corrigió un refresco duplicado del resumen y se conserva un refresco posterior cuando la primera lectura precede a una escritura. El temporizador de stock se comprueba sin reproducir todos los frames de animación. Las cifras de suites focales se solapan y no se suman como pruebas independientes.

Chrome verificó manifiestos de tienda y administración con identificadores distintos y cero errores de instalabilidad. El worker público conserva solo la pantalla genérica offline; no guarda pedidos, API ni sesiones. La instalación física y el GPS en dispositivos reales siguen pendientes. La app nativa de reparto para iPhone aún requiere firma de Apple.

## Publicación y limpieza

Cloudflare y Render mantienen los servicios existentes. La limpieza del repositorio no modifica tablas, datos comerciales, secretos del servidor, precios ni tarifas. Se conservan los controles JWT y de rol, las mascotas y el APK Android verificado.

El repositorio publicable conserva código, pruebas y documentación operativa. Se archivaron en una copia local privada los recursos de preparación de mascotas, capturas antiguas, planes internos y el servicio auxiliar de notificaciones. Los workflows MVC y móvil quedan disponibles mediante ejecución manual; el workflow histórico que publicaba la raíz fue retirado.

Las capturas de pruebas se generan localmente en una carpeta excluida de Git. Los accesos de prueba y el respaldo privado no se publican. [Alcance de la revisión de seguridad](SEGURIDAD_DESPLIEGUE.md).

Después de la limpieza aprobaron 43 comprobaciones de instalación, recursos, configuración de producción y empaquetado de Pages, además de 38 pruebas históricas. El ZIP web se generó y verificó: 380 entradas, sin .env privado, certificados, bases, capturas ni el servicio auxiliar retirado. No se repitió la suite completa de navegador porque esta limpieza conserva el código de frontend, backend, móvil y sus dependencias.
