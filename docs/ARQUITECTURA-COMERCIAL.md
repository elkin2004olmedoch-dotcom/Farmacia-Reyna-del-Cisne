# Arquitectura de la farmacia

La aplicación conserva tres capas y el stack HTML/CSS/JavaScript, Node.js/Express y Prisma 6. El frontend de Cloudflare consume la API existente en Render; la persistencia remota usa PostgreSQL/Supabase y la instalación local dispone de SQLite.

## Separación de responsabilidades

| Capa | Responsabilidad |
| --- | --- |
| Presentación | frontend/controllers coordina eventos y estado; models centraliza HTTP y reglas de interfaz; views renderiza contenido y mensajes. El HTML se genera desde scripts/templates y scripts/build-frontend.cjs. |
| Aplicación | server/routes y middleware validan sesión, rol y entradas; controllers adapta HTTP; models aplica reglas farmacéuticas, importes, inventario, pedidos, entregas y facturación. |
| Persistencia | PrismaClient reutilizado y esquemas/migraciones separados en server/prisma y server/prisma/postgresql. Las transacciones preservan consistencia de stock, pedido y factura. |

Los esquemas son la fuente de verdad de relaciones y restricciones. Incluyen catálogo y promociones, usuarios/pedidos, proveedores/lotes/movimientos, configuración fiscal/facturas, zonas/tarifas/entregas, sesiones móviles y pagos. La limpieza del repositorio no modifica esos modelos ni datos existentes.

## Flujos compartidos

El servidor calcula precio, IVA, stock y envío; el cliente no impone importes. El pedido conserva su tarifa histórica, la clave de idempotencia pertenece al usuario y los cambios administrativos respetan la versión esperada del registro. El historial y las restricciones de persistencia evitan duplicar ventas o alterar documentos ya emitidos.

La tienda, la administración instalable y el reparto usan los mismos contratos autenticados. La autorización por rol y propietario se comprueba en la API. Instalar una app no concede acceso a la base ni privilegios nuevos. [Contrato de entregas](CONTRATO-ENTREGAS.md).

Farmi interpreta órdenes explícitas mediante los modelos existentes y el coordinador de actualizaciones del panel. No ejecuta código arbitrario ni llama a un proveedor de IA. El coordinador conserva un refresco posterior a una escritura sin superponer lecturas. [Guía funcional](ENTREGAS-Y-PRIVACIDAD.md).

## Crecimiento y operación

Los listados administrativos y de entregas tienen paginación; las validaciones y reglas de negocio se reutilizan desde web y móvil. El frontend carga módulos por pantalla. Los errores, estados de carga, salud del servicio y cierre controlado se mantienen dentro de los módulos existentes. No se introducen microservicios ni dependencias para esta limpieza.

Los límites reales dependen de la base, la instancia y los proveedores; no se afirma una capacidad no medida. Render conserva Free/Auto-Deploy Off. Una futura ampliación debe medir carga y consultas y revisar cuotas antes de cambiar el plan. PayPhone y firma móvil requieren activación independiente. El Reto 3 conserva el backend y espera el framework asignado.

[Seguridad](SEGURIDAD_DESPLIEGUE.md), [despliegue](DESPLIEGUE-GRATUITO.md), [pagos](PAGOS-Y-PAYPHONE.md), [criterios de Ecuador](ECUADOR-FARMACIA.md) y [pruebas](APPS-INSTALABLES-2026-11-01.md).
