# Farmacia comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Track completion in the adjacent progress file.

**Goal:** ampliar la farmacia existente con reparto privado, tarifas administrables, navegación comercial, carrito visual y asistente administrativo con operaciones verificables.

**Architecture:** presentación MVC HTML/CSS/JS → aplicación Express con permisos y reglas → Prisma 6/PostgreSQL, con SQLite de prueba. Se reutilizan los modelos existentes; se añaden solamente zonas y entregas necesarias.

**Tech Stack:** JavaScript, Express 5, Prisma 6.19.3, PostgreSQL/Supabase, HTML/CSS, Playwright; sin framework nuevo.

**Spec:** `docs/superpowers/specs/2026-10-28-farmacia-comercial-design.md`.

## Global Constraints

- Cobertura inicial: Puerto Quito/Pichincha; tarifa nullable hasta configuración administrativa explícita, 0 es gratuidad explícita.
- Conservar marca, colores, logos, tecnologías, datos comerciales e idempotencia/IVA/lotes/firmas existentes.
- No modificar checkouts anidados, entregables, secretos ni bases reales para pruebas.
- Usuario autoriza implementación y conexiones existentes; pruebas de cobros, comunicaciones o emisiones fiscales reales no forman parte de la verificación.
- No generar HTML durante ediciones concurrentes del generador; coordinar regeneración y PrismaClient antes de suites integradas.

## Review Focus

- Direcciones fuera de cobertura, tarifa pendiente o cambiada mientras se confirma: rechazo seguro o snapshot correcto sin cobrar tarifa inventada.
- Repartidor ajeno/inactivo, cliente ajeno o token antiguo: sin datos ni mutaciones; registro público jamás concede rol operativo.
- Cancelación, entrega, factura y lote vencido simultáneos: transacciones, versiones e idempotencia conservadas.
- GPS negado/antiguo/futuro/fuera de orden/página oculta: no inventar posición ni bloquear estados; retiro y caducidad efectivos.
- Comandos ambiguos, inyección, producto restringido, teclado y móvil: validaciones actuales, información real, foco preservado y errores comprensibles.

## Task 1: Persistencia y negocio de reparto

**Files:** ambos schemas y nuevas migraciones; nuevos `server/models/entregas.cjs`, `server/controllers/entregas.cjs`, `server/routes/entregas.cjs`; `pedidos.cjs`, `sri-document.cjs`, validación de comprador; pruebas Node de entregas/tarifas.

**Produces:** zonas, tarifas, cuentas de repartidor, asignación, estados y GPS; snapshots de envío en pedidos/facturas. Endpoints documentados por el implementador antes de integrar la UI. Nuevas tablas con RLS y checks. Flags `Producto.controlado/biologico/cadenaFrio` en ambos schemas.

- [x] Escribir y ejecutar fallos para roles, cobertura, tarifa pendiente, tarifa histórica, fiscalidad, propiedad, estados/carreras, entrega/cancelación atómicas y ubicación.
- [x] Implementar migraciones aditivas, servicios/DTOs y rutas; extraer helper transaccional de estado del pedido sin duplicar sus restricciones.
- [x] Validar schemas, generar clientes y migrar únicamente bases temporales; ejecutar pruebas focalizadas y revisión.

## Task 2: Tienda y carrito

**Files:** `scripts/build-frontend.cjs`, `frontend/views/orders.js`, `frontend/views/products.js`, `frontend/controllers/catalog.js`, `frontend/assets/shop.css`, pruebas de UI pertinentes.

**Produces:** cabecera/buscador/categorías/cobertura, estructura comercial original, miniaturas y navegación preservada. Generador reserva integración de dos páginas nuevas a root después de entregar su edición.

- [x] Cubrir miniatura/alt, filtros conservados, búsqueda/categorías y navegación por teclado con pruebas de comportamiento.
- [x] Aplicar cambios acotados reutilizando tarjetas y estilos actuales; sin inventar campañas o métricas.
- [x] Comprobar sintaxis, pruebas focalizadas y revisión; no regenerar HTML mientras otros editan plantillas.

## Task 3: Asistente y mascotas

**Files:** `frontend/controllers/admin-command.mjs`, `admin-companion.js`, `mascota.js`, pruebas del parser/asistente.

**Consumes:** modelos administrativos existentes y contrato de entregas; integra eventos de navegación ya usados por admin.

- [x] Escribir fallos de comandos tipados, ambigüedad, fechas Ecuador, navegación sin catálogo y acciones reales de mascotas.
- [x] Implementar órdenes completas con endpoints existentes y permisos actuales; preparar acciones de entrega/zona mediante contrato nuevo. Datos faltantes abren formularios o generan preguntas concretas.
- [x] Verificar parser/integración, sin métodos arbitrarios ni secretos en mensajes; revisión independiente.

## Task 4: Ventanas, checkout y restricciones

**Files:** nuevos modelos/vistas/controladores de entregas y seguimiento; `app.js`, `auth.js`, `layout.js`, `account.js`, `checkout.js`; integración final del generador; CSS específico de reparto; política sanitaria y validación/productos/promociones en servidor.

**Consumes:** contrato Task 1 y marcado Task 2. Root es responsable de archivos compartidos tras finalizar ediciones delegadas.

- [x] Añadir pruebas de cliente/repartidor/admin, tarifario, destino opcional, mapa por decisión del usuario, llamada al llegar, teclado y privacidad.
- [x] Implementar `entregas.html` y `seguimiento.html`, roles, formularios de zonas/repartidores/asignación y refresco seguro; mostrar envío/subtotal/total reales.
- [x] Bloquear compra automática y campañas según flags sanitarios, manteniendo PVP/IVA/receta existentes. Cubrirlo con regresiones antes del cambio.
- [x] Integrar helper de ubicación y proveedor de mapas; permisos propios de geolocalización, CSP exacta y avisos de privacidad.

## Task 5: Verificación, Supabase y publicación

- [x] Revisar cada dominio y resolver hallazgos; ejecutar Node, tienda histórica, navegador y Pages/API completos, además del agente .NET con el SDK local si está disponible.
- [x] Regenerar HTML y artefacto público; validar imports, privacidad del artefacto y ausencia de secretos; conservar capturas históricas.
- [x] Verificar conexión Supabase y estado de migraciones por lectura. Respaldar base/Storage de forma privada antes de cualquier migración aditiva real; conservar checksums/resultados saneados.
- [x] Aplicar migraciones revisadas sin seed ni datos de prueba sobre producción; verificar restricciones/RLS y conservación de registros.
- [x] Preparar fuente en copia separada del historial remoto, verificar diferencias y publicar solo versiones probadas en servicios autorizados, con rollback. No alterar planes de pago o DNS sin necesidad/alcance explícito.
- [x] Actualizar arquitectura, manual de operación/cobertura, integraciones/normativa y evidencia exacta. Separar pruebas temporales, lecturas públicas y comprobaciones reales.
