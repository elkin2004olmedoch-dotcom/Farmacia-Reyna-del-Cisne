# Auditoría del Reto 2

Fecha: 11 de octubre de 2026. Alcance: farmacia MVC, API Express, SQLite local y PostgreSQL con Prisma, autenticación, dashboard ERP, conexión entre sesiones, estados/historial, descuentos reales, imágenes, fiscalidad/SRI y respaldo local. Incluye publicación de promociones y servicio independiente C# de inventario con canales desactivados. Requisitos originales en `docs/REQUISITOS-RETO-2.txt`.

Se utiliza SQLite como motor relacional local, de acuerdo con la alternativa del enunciado y la confirmación del estudiante. PostgreSQL y Storage de Supabase están conectados y contienen el traslado comprobado de los datos locales. Express ya está activo en [Render Free](https://farmacia-reina-del-cisne.onrender.com), con el primer despliegue y un despliegue manual del mismo commit `b987744` en estado Live. SQL Server no es el motor de esta entrega. La persistencia de cuentas y pedidos se comprobó con ambos motores; el pago se coordina con la farmacia y no hay pasarela bancaria.

| Punto obligatorio | Informe | Subpuntos revisados |
|---|---|---|
| 1. Arquitectura | [01 — MVC](01-arquitectura-mvc.md) | 1.1 Frontend; 1.2 backend; capas, promociones y servicio .NET independiente |
| 2. Persistencia | [02 — Prisma y base de datos](02-persistencia-prisma.md) | 2.1 Entidades/FK, snapshots, concurrencia, restauración y SQL integrado/standalone del agente |
| 3. API | [03 — API REST](03-api-rest.md) | 3.1 Auth/CRUD/pedidos, descuentos, HTTP, contratos privados y webhooks del agente |
| 4. Seguridad | [04 — Seguridad](04-seguridad.md) | 4.1 OWASP; 4.2 JWT; 4.3 CORS; 4.4 bcrypt; 4.5 entradas; 4.6 HTTPS; RLS, HMAC y deduplicación |
| 5. Funciones frontend | [05 — Flujos y accesibilidad](05-frontend-accesibilidad.md) | 5.1 catálogo; 5.2 carrito; 5.3 login; 5.4 checkout; 5.5 administración, publicación, descuento visual y accesibilidad |

Cada informe incluye matriz de cumplimiento, evidencia reproducible, hallazgos corregidos y límites. Los resultados de ejecución se conservan en `docs/pruebas/reto2/`.

La ejecución final aprobó **136 pruebas Node y 40 de Chrome**, con cero fallos; el antecedente estático conserva **34 pruebas aprobadas** y **npm audit reportó cero vulnerabilidades**. Resultados en [evidencias](../../pruebas/reto2/README.md) y `resumen.json`. Node cubre permisos, reconexión, concurrencia, transiciones/cancelación, descuentos, migración antigua, imágenes y respaldo/restauración, incluido destino corrupto, además de configuración, almacenamiento e importación para nube. Chrome cubre cliente/admin en escritorio y móvil, filtros/formularios, errores, imágenes, estados y descuento. Axe incluye editor de imágenes, diálogo de estados, catálogo con descuento y ficha. Guardar bloquea cierre y campos, incluidos imagen/reset/porcentaje y selector de estado, y evita envíos duplicados. Quitar la imagen propia de promoción persiste null y reutiliza el producto.

Las 136 pruebas Node y 40 de navegador son repetibles y aisladas: API y navegador usan SQLite real temporal; los casos de almacenamiento e importación aíslan servicios externos con simulaciones. En la etapa inicial de conexión, se ejecutaron **17 comprobaciones puntuales con Express desde el equipo local contra PostgreSQL y Storage reales de Supabase**. Estas verificaron login del administrador conservado, registro/login de cliente, permisos 401/403, resumen ERP, carga WebP, edición visible para el cliente, promoción con imagen propia, descuento del 25 % de $12 a $9, pedido de dos unidades por $18, stock de cinco a tres, cancelación repetida con una sola reposición a cinco, estado visible para el cliente y persistencia tras reconectar. Esas 17 comprobaciones corresponden a la etapa previa de conexión y no se suman a la suite automatizada.

En el servicio público de Render pasaron **16 comprobaciones puntuales de API** de autenticación, roles, resumen, imágenes, edición, promociones, pedidos, stock y cancelación. También se verificó la interfaz real en navegador: login del administrador redirige al Dashboard ERP; una sesión de cliente en otra pestaña ve su pedido cancelado; la edición administrativa de imagen PNG, recodificada a WebP, y de precio de $12 a $14 aparece en la ficha del cliente, con la imagen cargada, franja de promoción del 25 % y precio efectivo de $10,50. Estas comprobaciones de API e interfaz pública se distinguen de las pruebas aisladas y de la verificación anterior desde el equipo local.

En esa etapa inicial, la migración PostgreSQL se aplicó y RLS quedó habilitado sin políticas públicas en las siete tablas de la farmacia y `_prisma_migrations`. El traslado conservó un administrador, 18 productos, dos promociones, una marca Semilla y cero pedidos. La comparación de cada fila de las siete tablas y del SHA-256 de la imagen trasladada coincidió con el origen, incluidos los hashes de credenciales. Los datos sintéticos de la verificación real se limpiaron y se volvió a comprobar esa paridad; no se publican filas privadas ni secretos como evidencia. El [alcance de la verificación de nube](../../pruebas/reto2/nube.json) distingue la suite aislada, el traslado y las comprobaciones reales.

El reinicio real de Render aprobó seis comprobaciones: registros conservados, imágenes con el mismo SHA-256, login del administrador, login del cliente, pedido histórico cancelado por $18 y edición de interfaz conservada con precio base de $14, descuento del 25 %, precio efectivo de $10,50 e imagen WebP. Después se retiraron únicamente los datos sintéticos y sus dos imágenes. La comprobación final volvió a confirmar igualdad de cada fila de las siete tablas y del SHA-256 de la imagen original con el origen: un administrador, 18 productos, dos promociones, una marca Semilla y cero pedidos, detalles o eventos. El [alcance de nube](../../pruebas/reto2/nube.json) registra estas comprobaciones, separadas de las suites aisladas.

La configuración de GitHub Pages apunta al origen público de Render en `data/deployment.json` y el service worker está actualizado. Se publicó el commit `230322d774ef8e8f3cb212b73442b0f2b5ba8041`; las ejecuciones `38161030230` (Deploy GitHub Pages) y `38161029803` (pages-build-deployment) finalizaron correctamente. La consulta pública de `data/deployment.json` respondió 200 con el origen de Render. En navegador se abrió el [enlace exacto del producto aportado por el usuario](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/producto.html?id=alcohol-antiseptico) y redirigió a la misma ficha e identificador en Render: mostró «Alcohol antiséptico zzzz», $2,01, stock 600 y la imagen original cargada. Se conserva la [captura de la redirección y ficha](../../pruebas/reto2/capturas/nube-pages-producto.jpg). La aplicación compartida también puede abrirse directamente en [Render](https://farmacia-reina-del-cisne.onrender.com). El funcionamiento observado no constituye una garantía de disponibilidad continua de los planes gratuitos.

La migración commerce de la base de trabajo se aplicó con respaldo privado e integridad comprobada; SHA-256 de los campos originales de las cinco entidades comerciales quedó idéntico. Las copias, credenciales y base real no se publican como evidencia. Los respaldos automáticos/manuales son locales y la restauración requiere servidor detenido.

La restauración de un destino SQLite corrupto conserva antes sus bytes DB/WAL/SHM en una recuperación privada con SHA-256, sin poda automática. Esa copia forense no se presenta como respaldo restaurable. Solo después se publica una fuente previamente validada; si conservar el destino falla, se aborta sin sustituirlo. La prueba aislada verificó igualdad byte por byte y recuperación, sin restaurar destructivamente la base de trabajo.

## Ampliación verificada el 11 de octubre de 2026

Los cinco informes incorporan fiscalidad, farmacia y facturación SRI: descuentos 0–85 %, IVA por vigencia y fundamento para tarifa 0 %, PVP, proveedores, lotes/caducidad, FEFO, movimientos, emisor y certificados privados, numeración, XML/RIDE y permisos del comprador. Las 136 pruebas Node y 40 recorridos de navegador pasan; la instalación limpia pasa 19 comprobaciones. Las pruebas de emisión usan certificados y respuestas sintéticas. Emisor y firma reales quedan sin configurar para revisión; ninguna factura real se envió al SRI.

Las seis migraciones se aplicaron en SQLite y Supabase con copias privadas previas. Se compararon todos los campos y filas anteriores: los siete conjuntos originales de cada instalación permanecen iguales. Supabase tiene 16 tablas con RLS y sin políticas públicas. Las ocho comprobaciones de restricciones PostgreSQL se realizaron con datos sintéticos en transacciones revertidas. Evidencias: [local](../../pruebas/reto2/ampliacion-local.json), [nube](../../pruebas/reto2/ampliacion-nube.json) y [restricciones](../../pruebas/reto2/restricciones-postgresql.json). Esta ampliación conserva los datos creados por el usuario después del traslado inicial.

## Relación con los diez criterios de la rúbrica

| Criterio | Evidencia principal |
|---|---|
| 1. MVC frontend | Informe 01; `frontend/models`, `views`, `controllers` |
| 2. MVC backend | Informe 01; `server/routes`, `controllers`, `models`, `middleware` |
| 3. Persistencia y Prisma | Informe 02; schema, migración SQL, seed, prueba de reapertura |
| 4. API REST | Informe 03; endpoints y pruebas HTTP |
| 5. JWT | Informe 04; firma, vencimiento, revocación y middleware |
| 6. Roles | Informe 04; usuario recibe 403; admin CRUD y consultas |
| 7. Seguridad OWASP | Informe 04; validación, sanitización, CORS, hashing y cabeceras |
| 8. Frontend funcional | Informe 05; suite en dos tamaños, dashboard/roles, conexión, estados, promociones e imágenes |
| 9. Accesibilidad | Informe 05; axe, navegación con teclado, labels y diálogos |
| 10. Documentación | README raíz; cinco informes; evidencias; instalación y ZIP |

La auditoría documenta el resultado técnico observado; no asigna una calificación ni constituye una certificación de seguridad o WCAG.

## Cierre de promociones y agente de inventario

La verificación vigente aprobó **136 pruebas Node y 40 Chrome**, separadas de los recorridos reales e históricos descritos arriba. Se publicó `cuidado-solar`, que tenía 26 % pero permanecía en vista previa, conservando producto, USD 9,75 original y fin a las 14:59 de Ecuador del 11 de octubre. Al verificarla, campaña y ficha coincidían en USD 7,22. No se extendió la vigencia ni se creó una compra real. [Publicación](../../pruebas/reto2/promocion-publicada.json), [comparación de las 15 tablas según el cambio autorizado](../../pruebas/reto2/promocion-corregida.json).

Los **cinco puntos** incorporan el servicio ASP.NET Core .NET 10 en `services/inventory-agent/`: arquitectura independiente, PostgreSQL integrado o standalone excluyentes, estado durable, RLS/permisos por rol, contratos administrativos, HMAC/webhooks y pruebas con transportes simulados. Primordial es automático; intermedio/bajo requieren gerente. El servicio no duplica stock, no ingresa mercancía por correo ni modifica SQLite.

La ejecución final C# recompiló el código definitivo y aprobó **92 de 92 pruebas**: 76 de dominio/HTTP/transportes y 16 de PostgreSQL, con cero fallos, cero omisiones y cero envíos reales. Incluye las regresiones de callback temprano y reintento en ambos canales; la auditoría de paquetes .NET reportó cero vulnerabilidades. Los informes [resultados](../../pruebas/reto2/inventory-agent-results.json), [salida de pruebas](../../pruebas/reto2/inventory-agent-tests.txt) y [dependencias](../../pruebas/reto2/inventory-agent-dependencies.json) registran esa ejecución independiente, sin sumarla a Node/Chrome. [Evidencias](../../pruebas/reto2/README.md).

Agente y canales desactivados, sin mensajes reales. Credenciales, aprobación/elegibilidad de WhatsApp y alojamiento permanente siguen pendientes. Render Free bloquea SMTP, por lo que no se activa allí este agente de correo; la farmacia Node pública conserva su alojamiento. [Guía de instalación y límites](../../AGENTE-INVENTARIO.md).
