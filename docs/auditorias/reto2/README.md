# Auditoría del Reto 2

Fecha: 9 de octubre de 2026. Alcance: farmacia MVC, API Express, SQLite/Prisma, autenticación, dashboard ERP, conexión entre sesiones, estados/historial, descuentos reales, imágenes y respaldo local. Requisitos originales en `docs/REQUISITOS-RETO-2.txt`.

Se utiliza SQLite como motor relacional, de acuerdo con la alternativa del enunciado y la confirmación del estudiante. SQL Server no es el motor de esta entrega. La base de datos, las cuentas y los pedidos son reales; el pago se coordina con la farmacia y no hay pasarela bancaria.

| Punto obligatorio | Informe | Subpuntos revisados |
|---|---|---|
| 1. Arquitectura | [01 — MVC](01-arquitectura-mvc.md) | 1.1 Frontend; 1.2 backend; capas, dashboard, refresco, imágenes y precios compartidos |
| 2. Persistencia | [02 — Prisma y base de datos](02-persistencia-prisma.md) | 2.1 Entidades/FK, historial, migración histórica, snapshots, seed, concurrencia y restauración |
| 3. API | [03 — API REST](03-api-rest.md) | 3.1 Auth/CRUD/pedidos, transiciones, imágenes, descuentos, HTTP y conflictos 409 |
| 4. Seguridad | [04 — Seguridad](04-seguridad.md) | 4.1 OWASP; 4.2 JWT; 4.3 CORS; 4.4 bcrypt; 4.5 entradas; 4.6 HTTPS |
| 5. Funciones frontend | [05 — Flujos y accesibilidad](05-frontend-accesibilidad.md) | 5.1 catálogo; 5.2 carrito; 5.3 login; 5.4 checkout; 5.5 administración, estados, descuento visual, imágenes y accesibilidad |

Cada informe incluye matriz de cumplimiento, evidencia reproducible, hallazgos corregidos y límites. Los resultados de ejecución se conservan en `docs/pruebas/reto2/`.

La ejecución final aprobó **37 pruebas Node y 14 de Chrome**, con cero fallos; **npm audit reportó cero vulnerabilidades**. Resultados en [evidencias](../../pruebas/reto2/README.md) y `resumen.json`. Node cubre permisos, reconexión, concurrencia, transiciones/cancelación, descuentos, migración antigua, imágenes y respaldo/restauración, incluido destino corrupto. Chrome cubre cliente/admin en escritorio y móvil, filtros/formularios, errores, imágenes, estados y descuento. Axe incluye editor de imágenes, diálogo de estados, catálogo con descuento y ficha. Guardar bloquea cierre y campos, incluidos imagen/reset/porcentaje y selector de estado, y evita envíos duplicados. Quitar la imagen propia de promoción persiste null y reutiliza el producto.

La migración commerce de la base de trabajo se aplicó con respaldo privado e integridad comprobada; SHA-256 de los campos originales de las cinco entidades comerciales quedó idéntico. Las copias, credenciales y base real no se publican como evidencia. Los respaldos automáticos/manuales son locales y la restauración requiere servidor detenido.

La restauración de un destino SQLite corrupto conserva antes sus bytes DB/WAL/SHM en una recuperación privada con SHA-256, sin poda automática. Esa copia forense no se presenta como respaldo restaurable. Solo después se publica una fuente previamente validada; si conservar el destino falla, se aborta sin sustituirlo. La prueba aislada verificó igualdad byte por byte y recuperación, sin restaurar destructivamente la base de trabajo.

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
