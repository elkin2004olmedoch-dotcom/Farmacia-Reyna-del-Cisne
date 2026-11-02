# Revisión para publicación del repositorio

## Alcance y resultado

Se revisaron archivos versionados, ejemplos, workflows y el historial alcanzable desde todas las referencias locales obtenidas del remoto: 117 commits y 1.460 blobs, sobre la base d2e080f5026b9cae343df0d0f1a6177f5b77e1e8. Se compararon en memoria las credenciales privadas existentes sin imprimirlas ni copiarlas al informe.

No hubo coincidencias con los valores privados comparados. Los patrones con apariencia de claves correspondían a ejemplos y fixtures sintéticas. Los correos de commits revisados corresponden a noreply, direcciones de ejemplo o dominios locales; no se encontró una dirección personal de correo público en esos metadatos. Los nuevos commits usan el correo noreply de GitHub. Esta comprobación no certifica ausencia universal de secretos desconocidos.

## Hallazgos corregidos

| ID | Prioridad y evidencia | Acción |
| --- | --- | --- |
| PUB-01 | Baja: entrega/mascotas-v3 y docs/pruebas contenían material de preparación y capturas ajeno al runtime | Archivo local privado y exclusión de futuras salidas en .gitignore; frontend/assets/mascotas se conserva |
| PUB-02 | Media: verify-mobile.yml y verify-mvc.yml se disparaban automáticamente, incluyendo macOS/iOS | Ambos workflows quedan manuales, con permisos de lectura y límites de ejecución; se conservan las pruebas |
| PUB-03 | Media: pages.yml publicaba toda la raíz y el agente auxiliar tenía un workflow propio | Retirados del árbol actual junto al servicio auxiliar independiente; no se cambia Cloudflare |
| PUB-04 | Media: render.yaml declaraba autoDeployTrigger commit y solo el origen de Render | Blueprint actualizado a off, plan Free y orígenes exactos de Cloudflare/Render; no se reaplica ni se cambian secretos |

Se verificó una copia completa de los archivos y un bundle Git antes de retirar material. Se conserva el historial; archivar el árbol actual no borra versiones anteriores ni copias que ya existieran.

También se revisaron 15 registros de descripciones, comentarios y releases, sin coincidencias con valores privados ni correos personales. Los 16 artefactos antiguos de Actions se respaldaron con SHA-256 y CRC verificados y se retiraron del alojamiento (466.036.098 bytes). Se eliminaron 6 cachés regenerables (332.593.326 bytes). Las listas remotas quedaron vacías; la descarga vigente de reparto permanece en Cloudflare. Las futuras salidas de workflows manuales tienen retención de tres días.

## Controles que se conservan

Las operaciones privadas de la API exigen JWT, usuario activo y rol. Pedidos, seguimiento, facturas y pagos comprueban propiedad. CORS mantiene orígenes exactos y el navegador usa Authorization, sin sesión por cookies. Contraseñas, certificados, datos personales y claves se mantienen fuera de Git. El backend recalcula importes y stock y conserva idempotencia por usuario.

PayPhone permanece cerrado sin cuenta comercial configurada. Farmi no llama a IA externa. Maps se abre por enlaces o mediante carga voluntaria; no se añade una clave de Google facturable. No se activan correo, Telegram, WhatsApp Cloud API ni tareas programadas de notificaciones.

## Límites de gasto y comprobación

La limpieza no contrata planes ni cambia facturación. Render sigue Free con despliegue manual. Los workflows no se ejecutan por pushes o pull requests; el propietario puede lanzarlos manualmente. Una futura activación de proveedores o cambio de plan requiere revisar sus condiciones y configurar sus límites en el proveedor. El código público no protege contra cambios posteriores de la cuenta de facturación.

Se conservan las [pruebas de la versión funcional](APPS-INSTALABLES-2026-11-01.md). La revisión de publicación no es una prueba de penetración completa ni valida instalaciones físicas o GPS 24/7.
