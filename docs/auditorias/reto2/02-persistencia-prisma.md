# Punto 2 — Persistencia relacional con Prisma

## Objetivo y método

Verificar entidades, relaciones, migraciones, seed y almacenamiento real del pedido, además de la coherencia del resumen administrativo y las ediciones concurrentes. Se ejecutó `prisma migrate deploy`, se inicializó el catálogo y se hicieron consultas desde Prisma y HTTP. Las pruebas usan SQLite temporal, aplican las mismas migraciones de entrega y vuelven a abrir el archivo con otro PrismaClient para comprobar persistencia. La suite Node actual contiene 23 pruebas y pasó, incluyendo el resumen ERP, el conflicto de edición y la repetición del seed.

## Matriz de subpuntos

| Entidad / requisito 2.1 | Campos y relaciones | Evidencia | Resultado |
|---|---|---|---|
| Producto | `id`, `nombre`, `precio Decimal`, `stock Int`, `createdAt`; categoría, imagen, activo y actualización | Schema y CRUD HTTP | Implementado |
| Usuario | `id`, `email unique`, `passwordHash`, `role admin/user`; nombre, teléfono, activo y versión del token | Registro, bcrypt y login | Implementado |
| Pedido | `id`, `userId FK`, `total Decimal`, `createdAt`; entrega, comprador y documento enmascarado | POST pedidos y reapertura de BD | Implementado |
| PedidoDetalle | `id`, `pedidoId FK`, `productoId FK`, `cantidad`, `precioUnitario Decimal` | Pedido recuperado con detalles | Implementado |
| Carrito frontend | Solo identificadores y cantidades en localStorage | Recarga del navegador conserva selección | Implementado |
| Pedido final en BD | Cabecera y detalles en una transacción Prisma | Pedido sigue existiendo con otro cliente de BD | Implementado |
| Motor relacional | SQLite, alternativa aceptada por el estudiante | `provider = "sqlite"` y archivo real | Implementado con motor alternativo |
| Migraciones y seed | `202610090001_init`, `202610090002_seed_marker`, `seed.cjs` | Instalación desde BD vacía y repetición conservando el estado administrativo | Implementado |
| Resumen administrativo | Agregados de Producto, Usuario, Pedido y Promocion ya persistidos | `server/models/admin-summary.cjs`, endpoint protegido y pruebas del resumen | Implementado sin nuevas entidades ni migraciones |
| Semilla | ID de inicialización y `createdAt`; sin datos personales ni exposición en las tablas del panel | Marca `catalogo-inicial-v1`, detección del catálogo previo y prueba de seed repetido | Implementado como metadato de instalación |
| Edición concurrente | `Producto.updatedAt` comparado con `esperadoUpdatedAt` | Una compra u otra edición invalida la versión y devuelve 409 sin restaurar stock anterior | Implementado en el editor administrativo |

## Modelo y consistencia

```mermaid
erDiagram
  Usuario ||--o{ Pedido : realiza
  Pedido ||--|{ PedidoDetalle : contiene
  Producto ||--o{ PedidoDetalle : referencia
  Producto ||--o{ Promocion : presenta
```

Se agregan campañas a `Promocion` para la administración solicitada previamente. La migración contiene claves primarias, foráneas e índices únicos para correo, detalles por producto y la clave de confirmación por usuario. Las relaciones usan Restrict para conservar el historial.

El servidor convierte precios a centavos para el cálculo y escribe el total con Prisma Decimal. Ignora precios de cliente porque el contrato del pedido solo acepta ID y cantidad. Un decremento condicionado por `stock >= cantidad`, dentro de una transacción serializable, impide sobreventa. Si falla cualquier línea, se revierte el pedido completo y el stock de todas las líneas.

La clave de confirmación se combina con el usuario y con una huella de la solicitud. Repetir exactamente el mismo pedido devuelve el existente; reutilizar la clave con otro contenido devuelve 409. La prueba simultánea de dos compras sobre una unidad produce una compra y un conflicto, manteniendo stock cero.

Los detalles guardan nombre y precio al comprar. Eliminar un producto lo desactiva y lo retira de nuevas compras, sin borrar detalles históricos. En una base nueva, el seed crea los 18 productos iniciales con stock de demostración y dos campañas de vista previa. La tabla Semilla marca esa inicialización con `catalogo-inicial-v1`: ejecutarlo de nuevo no vuelve a crear campañas eliminadas, reactivar productos, restaurar stock ni modificar contraseñas existentes.

La migración `202610090002_seed_marker` agrega únicamente ese metadato. Para adoptar una base creada antes de la marca, el seed detecta la presencia de IDs del catálogo inicial, conserva su estado y escribe la marca sin volver a insertar las campañas. La marca y la inicialización ocurren en una transacción Serializable. El administrador configurado se crea solo si no existe; si ese correo pertenece a un cliente, se rechaza la inicialización en lugar de elevar su rol.

El editor de productos conserva `updatedAt` al abrir y envía `esperadoUpdatedAt` al guardar. El modelo ejecuta `updateMany` condicionado por ID, producto activo y versión exacta dentro de una transacción Serializable. Si una compra descontó stock o un administrador cambió el registro entretanto, no actualiza ninguna fila y responde 409. Esto evita que guardar un precio desde un formulario antiguo restaure unidades vendidas. El campo de versión es opcional en el contrato HTTP por compatibilidad; el frontend de esta entrega lo incluye en todas las ediciones de producto.

## Snapshot del dashboard ERP

`server/models/admin-summary.cjs` realiza una transacción Prisma de lectura con aislamiento `Serializable`. Los conteos, sumas, alertas y listas pertenecen al mismo snapshot de la base de datos. El resumen no usa valores de muestra ni registra una segunda copia de la información.

- Los pedidos se agrupan por estado con `groupBy`; `_sum.total` se convierte desde Prisma Decimal a centavos enteros y se verifica que cada total quede dentro del rango seguro. El importe acumulado es la suma de los pedidos registrados, incluidos los estados existentes; no representa pagos recibidos ni facturación fiscal.
- La tendencia contiene seis meses calendario, incluido el actual. Sus límites se calculan para `America/Guayaquil` (UTC−5): desde la medianoche local del primer día hasta el inicio del mes siguiente, con límite final exclusivo. La tarjeta del mes usa el último período de esa tendencia.
- Productos, clientes y administradores se cuentan solo si están activos. Las alertas incluyen productos activos con stock menor o igual a cinco; la lista muestra como máximo diez, ordenados por stock, nombre e ID, y el conteo conserva el total real aunque haya más alertas.
- Los pedidos recientes son los cinco más nuevos, con desempate por ID. La consulta selecciona únicamente ID, nombre del comprador, importe, estado y fecha para esta sección.
- Las campañas visibles deben estar activas, referenciar un producto activo y cumplir su vigencia: inicio nulo o ya alcanzado; fin nulo o posterior al instante del resumen. Las campañas de vista previa se incluyen porque también son visibles en la tienda.

No se alteró el schema ni se añadió una migración para el dashboard: todas sus consultas usan las entidades y relaciones existentes. La migración posterior de Semilla corresponde al control de inicialización. El snapshot se vuelve a solicitar al entrar, reintentar, recuperar el foco o cada 30 segundos mientras el panel permanece visible; no se usa una conexión de eventos en tiempo real.

## Evidencia reproducible

```powershell
npm ci
npm run setup
npm test
```

Casos específicos: registro con hash, CRUD persistido, total servidor, pedido con detalles, reversión por stock, concurrencia, conservación histórica, reapertura de BD, resumen administrativo, edición con versión vencida y repetición del seed conservando campañas eliminadas y credenciales. La prueba de reconexión comprueba conjuntamente usuario, producto editado, campaña, pedido, detalles y stock. El archivo de trabajo es `server/prisma/farmacia.db`, excluido de Git y ZIP; la entrega incluye schema, SQL y seed para reconstruirlo.

## Hallazgos y límites

- Cerrado: el pedido anterior desaparecía fuera del navegador; ahora pertenece al usuario y persiste en BD.
- Cerrado: el total podía venir del cliente; ahora se obtiene exclusivamente del catálogo persistido.
- Cerrado: reintentos podían descontar stock más de una vez; se incorporó idempotencia y prueba de repetición.
- Cerrado: el panel no tenía una vista agregada de la operación; el dashboard ahora obtiene métricas, alertas y pedidos desde un snapshot relacional sin mantener totales paralelos.
- Cerrado: una edición abierta podía restaurar stock anterior a una compra; el editor envía la versión y el modelo rechaza el conflicto sin modificar la fila.
- Cerrado: repetir setup podía recrear una campaña inicial eliminada; la marca de seed conserva el catálogo existente y adopta bases anteriores sin duplicarlo.
- El PUT sin `esperadoUpdatedAt` conserva la compatibilidad del contrato previo y no aplica el control de versión. Los consumidores externos que quieran proteger sus ediciones deben enviar ese campo.
- SQLite es suficiente para la entrega y tiene un solo escritor concurrente; la operación a mayor escala requerirá evaluar un motor servidor, copias de seguridad y migración explícita. Cambiar solo DATABASE_URL no cambia el proveedor.
- SQL Server no se instaló ni se presenta como probado. Se implementó el motor alternativo autorizado.
