# Auditoría del Reto 2

Fecha: 9 de octubre de 2026. Alcance: aplicación de farmacia MVC, API Express, SQLite con Prisma, autenticación, autorización, dashboard ERP y conexión entre administración y tienda. Los requisitos originales están conservados en `docs/REQUISITOS-RETO-2.txt`.

Se utiliza SQLite como motor relacional, de acuerdo con la alternativa del enunciado y la confirmación del estudiante. SQL Server no es el motor de esta entrega. La base de datos, las cuentas y los pedidos son reales; el pago se coordina con la farmacia y no hay pasarela bancaria.

| Punto obligatorio | Informe | Subpuntos revisados |
|---|---|---|
| 1. Arquitectura | [01 — MVC](01-arquitectura-mvc.md) | 1.1 Frontend; 1.2 backend; capas, dashboard y coordinador de refresco |
| 2. Persistencia | [02 — Prisma y base de datos](02-persistencia-prisma.md) | 2.1 Producto, Usuario, Pedido, PedidoDetalle; migraciones, seed marcado, snapshot y edición concurrente |
| 3. API | [03 — API REST](03-api-rest.md) | 3.1 Auth, CRUD productos y pedidos; HTTP, resumen, conflictos 409 y paginación |
| 4. Seguridad | [04 — Seguridad](04-seguridad.md) | 4.1 OWASP; 4.2 JWT; 4.3 CORS; 4.4 bcrypt; 4.5 entradas; 4.6 HTTPS |
| 5. Funciones frontend | [05 — Flujos y accesibilidad](05-frontend-accesibilidad.md) | 5.1 catálogo; 5.2 carrito; 5.3 login; 5.4 checkout; 5.5 administración, conexión entre pantallas y accesibilidad |

Cada informe incluye matriz de cumplimiento, evidencia reproducible, hallazgos corregidos y límites. Los resultados de ejecución se conservan en `docs/pruebas/reto2/`.

Estado de la revisión ampliada: **23 pruebas Node aprobadas**. Cubren el resumen, persistencia entre conexiones, conflicto de versión tras una compra/edición y seed repetido conservando el estado existente. La suite de navegador pasó **14 casos en dos tamaños**, incluyendo conexión entre contextos, conservación de filtros/formularios, permisos y dashboard. La auditoría de dependencias reportó cero vulnerabilidades.

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
| 8. Frontend funcional | Informe 05; suite de 14 casos en dos tamaños, incluidos dashboard, roles y conexión entre sesiones; 14 ejecuciones aprobadas |
| 9. Accesibilidad | Informe 05; axe, navegación con teclado, labels y diálogos |
| 10. Documentación | README raíz; cinco informes; evidencias; instalación y ZIP |

La auditoría documenta el resultado técnico observado; no asigna una calificación ni constituye una certificación de seguridad o WCAG.
