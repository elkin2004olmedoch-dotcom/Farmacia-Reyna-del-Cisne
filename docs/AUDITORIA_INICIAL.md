# Auditoría inicial de la farmacia

Nota de integración: esta auditoría registra la copia local original, anterior a contrastarla con el historial remoto `1e55805`. En ese remoto, GitHub Pages publica una tienda histórica independiente con mascotas; se conserva ese comportamiento, junto con el asistente administrativo y las estadísticas por categoría. Las mediciones de la copia original no constituyen una nueva medición de esta integración.

Fecha: 2026-10-21. Alcance: fase 0, diagnóstico de fase 1 y tres correcciones de rendimiento de bajo riesgo. Las fases siguientes del encargo maestro quedan pendientes de revisar este diagnóstico con el propietario.

## 1. Arquitectura actual

| Componente | Estado comprobado |
| --- | --- |
| Frontend activo | HTML, CSS y módulos JavaScript MVC en `frontend/`; Express sirve esa carpeta, no `public/`. |
| Frontend histórico | HTML raíz, `js/`, `assets/`, `data/`; está conservado expresamente como Reto 1. GitHub Pages redirige al origen configurado en `data/deployment.json`. |
| Generación | `scripts/build-frontend.cjs` genera nueve páginas MVC; toma el contenido de inicio del HTML raíz. Hay que conservar la plantilla al cambiar HTML generado. |
| Backend | Node.js, Express 5.3.0, rutas/controladores/modelos y middleware existentes en `server/`. Prefijo actual `/api`; no `/api/v1`. |
| ORM | Prisma y `@prisma/client` 6.19.3. Cliente compartido por módulo en `server/models/db.cjs`; no se instancia por petición. |
| Base local | SQLite, confirmado por proveedor del esquema, protocolo configurado y cliente generado. No se inspeccionaron los datos privados. |
| Base de nube prevista | PostgreSQL, esquema/migraciones propios en `server/prisma/postgresql/`; preparación para Supabase y almacenamiento remoto de imágenes. No se verificó la conexión de producción. |
| Hosting | El propietario confirmó `https://farmacia-reina-del-cisne.onrender.com`. `render.yaml` configura Render Free. No se encontró configuración Vercel en el árbol activo examinado. |
| Servicio auxiliar | Existe un agente de inventario C#/.NET en `services/inventory-agent/`, con CI propio; no fue modificado ni probado en esta iteración. |

Los dos esquemas contienen los mismos 15 modelos funcionales: Producto, Usuario, Pedido, PedidoDetalle, Promocion, PedidoEstado, Semilla, ConfiguracionFiscal, Proveedor, Lote, MovimientoInventario, PedidoDetalleLote, ConfiguracionEmisor, SecuenciaFactura y FacturaPedido. Sus relaciones preservan usuarios/pedidos, detalles/productos, lotes/asignaciones y facturas. No hay evidencia que justifique crear tablas equivalentes con nombres en inglés ni eliminar estructuras existentes.

La carpeta abierta no contiene `.git`. `github-work/` es otro checkout con su propio historial; no se modificó ni se creó allí una rama para una copia distinta. Se guardó un respaldo lógico del código y recursos originales, sin `.env`, claves, bases, uploads ni artefactos, fuera del proyecto: `%TEMP%/farmacia-fase0-20261021-originales.zip`. La comparación de hashes permite revisar exactamente el alcance de los cambios.

## 2. Inventario de funcionalidades existentes

| Área | Existe | Pendiente frente al encargo maestro |
| --- | --- | --- |
| Autenticación | Registro, login, `/auth/me`, logout con revocación por versión; roles `user` y `admin`. | Verificación/recuperación por correo, sesiones individuales, MFA, permisos granulares y reautenticación. |
| Administración | Dashboard, productos, promociones, consulta de usuarios, pedidos, proveedores, lotes, movimientos, fiscalidad y SRI. | Gestión avanzada de personal, auditoría central, reportes ampliados y módulos de pagos/logística. |
| Catálogo/carrito | Precios, descuentos, IVA, disponibilidad, búsqueda, filtros, comparación y carrito local. | Reglas sanitarias revisadas por profesional, posibles campos adicionales y carrito persistente si se acuerda. |
| Inventario | Lotes, caducidad, FEFO, movimientos, reservas y transacciones. | Sucursales, bloqueos/alertas ampliadas y decisión sobre existencias sin lote. |
| Pedidos | Recalcula importes en servidor, idempotencia, transacción serializable, reserva/liberación e historial propio. | Estado de pago separado, cancelación del cliente, devoluciones y cobertura/costos configurables. |
| Pagos | Coordinación directa con farmacia y forma de pago fiscal. | Pasarela, transacciones verificadas, webhooks, conciliación y reembolsos. Una factura no acredita un cobro. |
| Seguimiento | Estados reales e historial del pedido propio, con actualización periódica. | Repartidores, asignación, GPS autorizado, ETA, incidencias y prueba de entrega. |
| Facturación | Implementación SRI con XML, firma, estados y descarga autorizada. | Validación operativa con emisor, certificados y respuesta real; no se emitió ninguna factura en esta iteración. |
| Notificaciones/soporte/privacidad | Contacto y ayuda existentes. | Proveedores transaccionales configurados, tickets, devoluciones, consentimientos y solicitudes de derechos. |
| API/CI | JSON coherente, validadores, errores centralizados, límites y pruebas Node/Playwright; CI del agente C#. | Versionado compatible, OpenAPI y CI de la aplicación web. |

Las ausencias de esta tabla son alcance futuro, no vulnerabilidades por sí mismas. No se añadieron endpoints, botones ni procesos ficticios para aparentar esas funciones.

## 3. Problemas encontrados

| ID | Evidencia | Evaluación y acción |
| --- | --- | --- |
| PERF-01 | El GET público no recibió cabeceras en 30.034,50 ms; DNS/TCP/TLS sí finalizaron. | Espera observada antes del HTML. Causa remota pendiente; no se atribuye automáticamente a Prisma o al frontend. |
| PERF-02 | La portada descargaba 10.758.005 bytes con caché vacía. Fachada PNG: 2.650.904 bytes; se solicitaban los tres atlas de mascotas. | Transferencia innecesaria medida. Corregida parcialmente con WebP sin pérdida y atlas bajo selección. |
| PERF-03 | `frontend/controllers/catalog.js` usaba `catalog.all()` para mostrar cuatro productos. Respuesta local completa: 15.177 bytes; página de cuatro: 3.262 bytes. | La portada y su refresco piden cuatro; catálogo y comparador conservan todos sus resultados. |
| PERF-04 | `frontend/controllers/app.js:11` espera restauración de sesión antes de inicializar la página; con token llama `/auth/me`. | Una API lenta puede bloquear contenido público con sesión guardada. No afecta a invitados sin token. Requiere preservar coherencia de roles; no se cambió como arreglo rápido. |
| PERF-05 | Catálogo completo solicita páginas de 100 secuencialmente; la entrada pública importa también módulos administrativos. | Oportunidades pendientes de medir con catálogo grande y cargas representativas. No se introdujo paralelismo ni separación de módulos sin necesidad probada. |
| DATA-01 | `server/models/productos.cjs:19,31` admite stock nuevo sin lote; `inventario.cjs:7,48` permite reservar saldo no asignado a lotes. | Limitación de trazabilidad/caducidad. Acordar tratamiento del saldo histórico y nuevas entradas antes de alterar stock o esquema. |
| DATA-02 | Productos y pedidos ordenan páginas solo por `createdAt` (`productos.cjs:15`, `pedidos.cjs:54`). | Riesgo de orden no determinista cuando coinciden fechas. No se reprodujeron omisiones/repeticiones. |
| DATA-03 | Migraciones PostgreSQL 004 y 006 agregan restricciones `NOT VALID`; no se localizó `VALIDATE CONSTRAINT`. | Los registros históricos no quedan certificados por esas migraciones. No se afirma que existan datos inválidos. |

Los archivos estáticos usan `maxAge:0`, que permite revalidación; la API y Fetch usan `no-store`. No se verificaron las cabeceras/compresión del hosting. La respuesta privada, la sesión y los pedidos no deben entrar en caché compartida. No se demostró una consulta N+1 ni falta de reutilización de PrismaClient.

## 4. Riesgos y controles de seguridad

- **SEC-01, bajo y condicionado a XSS:** JWT en `sessionStorage` (`frontend/models/auth.js:13`), accesible a JavaScript. No está en `localStorage` y no se encontró una cadena XSS explotable. Cookies HttpOnly y CSRF requieren un diseño de autenticación posterior.
- **SEC-02, medio condicionado a escalado/reinicios:** rate limiting en memoria (`server/routes/index.cjs:16`, `server/app.cjs:16`), sin almacenamiento común. Hay límites de login y API, pero varias instancias no compartirían sus contadores.
- **Controles comprobados en código:** bcrypt con coste 12, JWT con emisor/audiencia/caducidad/revocación, validación servidor, roles, acceso a pedidos/facturas por propietario, Helmet/CSP, CORS restrictivo, límites de cuerpo y validación/decodificación de imágenes. Los pedidos usan idempotencia, control de concurrencia y transacciones.
- No se registra la ausencia de CSRF como vulnerabilidad actual: la autorización exige Bearer y CORS usa `credentials:false`. Cambiar a cookies obliga a reevaluarlo.
- `.env.example` usa marcadores. Los secretos siguen en backend; no se copiaron sus valores ni se imprimieron URLs privadas. No se ejecutó una prueba de penetración ni se certifica ausencia de vulnerabilidades.

## 5. Diagnóstico de la carga

Metodología, muestras y resultados antes/después: [RENDIMIENTO.md](RENDIMIENTO.md). La observación remota y las mediciones locales son experimentos distintos.

Hipótesis prioritaria para revisar en Render: suspensión/arranque del plan Free, o inicialización/estado de la instancia. [Render documenta](https://render.com/docs/free#spinning-down-on-idle) suspensión tras 15 minutos sin tráfico y un reinicio que tarda aproximadamente un minuto. El YAML usa ese plan, pero este comportamiento no quedó demostrado en la petición medida. Se necesitan eventos y logs del servicio, configuración efectiva, región de aplicación/base y medición fría/caliente.

El peso de las imágenes sí retrasó el LCP de la copia local con red limitada. Reducirlo mejora esa parte de la carga, pero no resuelve por sí solo una espera anterior al HTML. No se garantiza apertura en 1–2 segundos ni una mejora de producción sin publicar y medir allí.

## 6. Funciones que faltan

La matriz de la sección 2 identifica las diferencias reales sin crear modelos duplicados. Antes de implementar autenticación avanzada, pagos, entregas, privacidad o nuevas APIs, se revisará este diagnóstico con el propietario. No se cambia bcrypt por Argon2id, roles, estados, rutas ni mecanismos de sesión en esta iteración.

## 7. Plan por prioridades

1. **Realizado:** establecer línea base, respaldar fuentes y medir portada/API/SQLite de prueba y acceso HTTP público.
2. **Realizado:** tres ajustes frontend acotados con pruebas de comportamiento y comparación antes/después; consultar los resultados y límites en `RENDIMIENTO.md`.
3. **Pendiente de acceso de lectura:** correlacionar el timeout con logs/eventos Render, arranque del proceso, región y latencia de PostgreSQL/pool. Medir login y `/auth/me` con una cuenta de prueba autorizada, sin credenciales reales en informes.
4. **Revisión del propietario:** decidir si se mantiene Render, se usa un plan apropiado o se diseña Vercel. No cambiar infraestructura, costos ni disponibilidad sin decisión informada.
5. **Después de revisar el diagnóstico:** arquitectura REST compatible, luego sesiones/RBAC/MFA y los módulos comerciales en el orden solicitado. Cada etapa necesita pruebas y revisión de sus transformaciones de datos.

## 8. Autorizaciones y revisiones pendientes

- Producción, cambios de hosting/planes/regiones, migraciones sensibles y transformaciones de stock requieren revisión antes de ejecutarse. No se desplegó nada.
- Proveedores de pago, correo, SMS, WhatsApp, mapas o GPS necesitan elección, configuración auténtica y autorización según sus costos/efectos. No se enviaron mensajes ni se realizaron cobros.
- Validación legal/sanitaria pendiente: productos admitidos para venta/entrega, recetas, publicidad, devoluciones, permisos del establecimiento, conservación fiscal, protección de datos y transferencias a proveedores. No se concluye cumplimiento ni se ofrecen textos como aprobados por un abogado o profesional sanitario.
- Consultar el [marco normativo oficial de la SPDP](https://www.spdp.gob.ec/marco-normativo/), la normativa vigente de ARCSA y las especificaciones oficiales SRI con profesionales competentes antes de implementar la fase normativa. La existencia de código fiscal no sustituye autorizaciones ni respuestas válidas del SRI.

## 9. Cambios y verificación de esta iteración

Archivos modificados:

- `frontend/models/catalog.js`: consulta limitada para destacados.
- `frontend/controllers/catalog.js`: portada/refresco usan esa consulta; catálogo/comparación conservan su comportamiento.
- `frontend/controllers/mascota.js`: no precarga atlas no seleccionados.
- `scripts/build-frontend.cjs`: conserva la elección de WebP al regenerar inicio.
- `frontend/index.html`: salida generada; solo cambia la URL de la fachada.

Archivos añadidos:

- `frontend/assets/images/farmacia-fachada-reina.webp`: imagen sin pérdida; PNG original conservado.
- `tests/reto2/performance.spec.cjs`: tres contratos de comportamiento, ejecutados en escritorio/móvil.
- `scripts/measure-performance.cjs`: medición reproducible con fixtures temporales y sin dependencias nuevas.
- `docs/AUDITORIA_INICIAL.md`, `docs/RENDIMIENTO.md` y `docs/pruebas/rendimiento-2026-10-21.json`: diagnóstico, resultados y evidencia.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `npm test` con `SRI_XSD_PYTHON` apuntando al Python local con lxml | 136 pasadas, 0 fallidas, 0 omitidas; solo BD temporal y proveedores simulados. |
| `npm run test:reto1` | 34 pasadas, 0 fallidas, 0 omitidas. |
| Playwright: `frontend.spec.cjs`, `order-tracking.spec.cjs`, `performance.spec.cjs`, escritorio y móvil | 24 pasadas; incluye login/compra, administración, sesiones vencidas, sincronización, nueve pantallas con análisis de accesibilidad, seguimiento y las correcciones. |
| `npm audit --json` | 0 vulnerabilidades conocidas reportadas; no demuestra ausencia de vulnerabilidades de aplicación. |
| `node --check` en los seis archivos JavaScript/CJS nuevos o modificados | Sin errores de sintaxis. |
| Comparación Sharp de PNG/WebP decodificados | Píxeles idénticos, mismas dimensiones. |
| Herramienta de medición conservada, ejecución `smoke` | Seis muestras completadas, sin errores de página; resultado en TEMP. No se usó esta ejecución concurrente con otras pruebas para calcular el antes/después. |
| Revisión independiente | Sin regresiones materiales detectadas en código/documentación; revisión estática. |

Las pruebas de seguimiento regeneran cuatro capturas históricas en `docs/pruebas/reto2/capturas/`; se guardó la evidencia nueva en TEMP y se restauraron los originales del respaldo para evitar cambios ajenos al parche. No se alteraron `package.json`, lockfile, `.env.example`, esquemas o migraciones.

Límites: no se ejecutó toda la suite Playwright ni el agente C#, ni se probaron funciones Vercel, proveedores reales o producción. Node avisó de detección automática ESM en una prueba existente; Playwright emitió avisos de variables de color, sin fallos. La compatibilidad y funciones anteriores quedan respaldadas por los escenarios ejecutados, no por una certificación completa del sistema.
