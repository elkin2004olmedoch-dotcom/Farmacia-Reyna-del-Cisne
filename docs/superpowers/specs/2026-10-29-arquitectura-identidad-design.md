# Arquitectura y experiencia de Reina del Cisne

El propietario solicita mejorar la arquitectura, corregir defectos y probar desde las funciones básicas hasta los recorridos completos. Elige una **experiencia elegante y centrada en el cuidado personal**. Se conservan vino, crema, logo, mascotas, catálogo, carrito con imágenes, entregas y seguimiento. La tarifa sigue siendo una decisión administrativa. PayPhone permanece preparado y desactivado hasta disponer de cuenta y validación comercial.

## Decisión de arquitectura

Mantener el monolito modular de tres capas: navegador MVC → API Express y reglas de negocio → Prisma 6 con SQLite local o PostgreSQL. Las capacidades de catálogo, inventario, pedidos, reparto, facturación y pagos conservan sus límites y sus permisos. Los recursos estáticos se publican en Cloudflare Pages; la API existente en Render utiliza Supabase. La tienda histórica de GitHub Pages es una publicación distinta.

Se valoraron conservar la carga global actual, separar la carga por pantalla dentro de este mismo sistema y distribuir servicios independientes. Se elige la segunda por criterio técnico: permite reducir transferencias y acotar consultas sin nuevas dependencias ni infraestructura. No existe medición que justifique distribuir servicios, añadir cachés o cambiar tecnología.

## Cambios verificables

1. Cargar únicamente los controladores necesarios para la pantalla solicitada. Mantener la restauración de sesión, las redirecciones por rol y la portada visible mientras se resuelve la sesión. Los controles nativos deben permanecer deshabilitados durante su preparación; los errores de datos recuperables deben conservar navegación y reintentos.
2. En las lecturas de precios públicos recuperar únicamente stock y vencimiento de lotes vencidos con existencias. No alterar reservas de inventario, snapshots monetarios ni transacciones. Añadir desempates únicos en la paginación existente.
3. Coordinar escucha y cierre del servidor: errores controlados, una sola limpieza y plazo máximo de cierre. Separar las comprobaciones de salud del presupuesto de tráfico comercial, conservando una política explícita contra abuso.
4. Crear una portada MVC propia, sin extraer su estructura del HTML histórico: composición editorial, fotografía real, selección de cuidado y compra clara. Reutilizar estilos existentes y limitar el ancho de lectura; conservar anclas, formularios y comportamiento accesible.

## Restricciones y validación

Sin migraciones de datos, nuevos paquetes, reescritura general, afirmaciones médicas ni promesas de entrega/cobro. Las pruebas utilizan bases temporales y respuestas sintéticas de proveedores. La publicación solo recibe comprobaciones de lectura.

Comparar recursos, peticiones y tiempos locales antes/después; no extrapolarlos a producción. Ejecutar pruebas Node, históricas, ambos proveedores de datos si el entorno temporal está disponible, navegador en escritorio/móvil y Pages entre orígenes. Cubrir autenticación, roles, inventario, precios, entrega, Maps/GPS simulado, Farmi, pagos simulados, errores, teclado y pantallas estrechas. Añadir regresiones de los defectos reproducidos. Conservar resultados exactos y capturas; registrar cualquier omisión o dependencia externa pendiente.

Las pruebas existentes también se deben poder ejecutar desde GitHub Actions sobre servicios y datos sintéticos, sin secretos comerciales ni despliegues automáticos desde el trabajo de verificación.
