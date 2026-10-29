# SDD ledger — plan: docs/superpowers/plans/2026-10-28-farmacia-comercial.md

## Identidad y punto de partida

- Carpeta original sin `.git`; no crear un repositorio nuevo ni modificar `github-work/` o `.publish/github/`.
- Respaldo de 279 fuentes con hashes: `C:/Users/Elkin/AppData/Local/Temp/farmacia-arquitectura-20261028-KVsP80`.
- Baseline del turno anterior: 305 pruebas aprobadas, audit 0, 94 archivos de Pages; evidencia `docs/pruebas/revision-2026-10-28.json`.
- Lectura Supabase con transacción READ ONLY: 18 productos, dos usuarios, un pedido; cuatro migraciones terminadas hasta `202610110006_pharmacy_pvp`. Ningún dato modificado.
- SDK .NET encontrado en `.publish/dotnet/dotnet.exe`, versión 10.0.401; no se instala otro.
- Referencia Fybeca y normas investigadas en vivo; fuentes del investigador en TEMP, sin copiar recursos del sitio.

## Pre-flight

| Tareas/interfaz | Comprobación | Resolución |
| --- | --- | --- |
| 1 / 4: schemas, DTO y rutas | Backend dueño de schemas, pedidos/fiscalidad y validación de comprador; root integra UI y política de productos después. | Publicar contrato exacto antes de UI; no editar a la vez el mismo archivo. |
| 2 / 4: generador y vistas orders | Tienda modifica marcado/cart; root integra páginas/envío después de entrega del agente. | Regeneración única coordinada. |
| 3 / 4: comandos/entregas | Asistente no puede inventar métodos del modelo nuevo. | Consumir contrato documentado; root integra adaptador. |
| 1: reglas existentes | Entregar/cancelar no debe abrir transacciones anidadas ni duplicar restricciones. | Extraer helper que reciba tx. |
| 2: referencia comercial | Un catálogo pequeño no justifica mega menú ni métricas inventadas. | Reutilizar categorías y campañas actuales. |
| 3: “hacer de todo” | No existen APIs para cualquier mutación imaginable, ni firmas/configuración privada completas. | Acciones tipadas ordinarias y formularios específicos para datos faltantes/privados; no ejecución arbitraria. |
| 4 / 5: proveedores | No hay clave Maps en configuración existente. | Maps URLs + mapa OSM voluntario; no activar Cloud billing o servicios pagados automáticamente. |
| 5: publicación/base | Hay credenciales privadas previas y permiso actual para conexiones existentes. | Backup, pruebas temporales y revisión antes de migración aditiva; cero operaciones comerciales de prueba. |

Ruling: ejecutar dentro de la autorización amplia actual sin nuevas aprobaciones de implementación — el propietario solicita acción autónoma y confirma cobertura/tarifa administrable; se registran decisiones técnicas y límites reales.

Ruling: la cobertura inicial es Puerto Quito completo; la tarifa queda pendiente hasta que administración introduzca un importe — evita inventar gratuidad o un cobro no acordado.

## Estado

- [x] Investigación y diseño/plan.
- [x] Persistencia y negocio de reparto.
- [x] Tienda y carrito.
- [x] Asistente y mascotas.
- [x] Ventanas, checkout y restricciones.
- [ ] Revisión, suites completas, respaldo/migración y publicación verificadas.

No se ha aplicado una migración real ni se ha publicado código nuevo en esta etapa.

## Integración implementada

- Backend: 18 modelos, ambos schemas/clientes Prisma6 validados; zonas/historial/entregas, shipping fiscal/XSD, roles y GPS. Revisión independiente sin hallazgos materiales.
- Tienda: generador11pantallas, búsqueda/categorías, miniaturas/URL/foco; focal storefront6/6 escritorio/móvil.
- Asistente: parser22/22, callbacks/formularios integrados, órdenes tipadas y activación real de controles de mascota. Hallazgos de unidades e identidad de lote corregidos.
- Ventanas: focal admin/asistente+reparto/privacidad6/6, incluyendo OSM voluntario/GPS/teléfono/cierre, después de corregir datos sintéticos inválidos y una espera de fixture por identidad única.
- Checkout: focal2/2, tarifa pendiente, actualización sin perder dirección, conflicto de tarifa y confirmación posterior única.
- PostgreSQL18 aislado local:5/5 con ACL/RLS/checks y traslado18entidades exacto; no usar DBreal para pruebas.
- Primera suite integrada Node:238/241,0omitidas. Tres fallos encontrados: limpieza GPS forzabaSQL antes de listen y dos stubs de pruebas no contemplaban nueva dependencia/temporizadores. Se difirió limpieza sin bloquear arranque;13/13 focales producción/diagnóstico ya pasan. Suite completa pendiente de repetir.
- Nueva copia Git separada en TEMP farmacia-comercial-release-f540134c, base remota40e922b de codex/separacion-cloudflare. No se ha hecho push. Las únicas diferencias previas con remoto son el mantenimiento del turno anterior documentado.
- Permiso actual autoriza implementación/conexiones existentes; siguen sin ejecutarse migraciones reales, compras, comunicaciones o emisión fiscal.

## Cierre de validación y migración

Node242/242, históricas38/38, Pages20/20 y .NET92/92; cero omisiones. Navegador última suite73/74 más repetición focal2/2 con paginación forzada, sin cambios posteriores de aplicación; cobertura de sus74casos, sin afirmar una tercera suite completa. Auditoría0 y ambos schemas Prisma6válidos. Capturas históricas28restauradas por hash; capturas nuevas fuera del repositorio.

Respaldo Supabase/Storage completo, hashes e índice pg_restore comprobados, sin restauración de datos reales para pruebas. Migración007 aplicada sin seed:15tablas previas conservadas,18productos/2usuarios/1pedido, nuevas tablas RLS y sin privilegios anon/authenticated. Zona Puerto Quito pendiente/1historial/0entregas. Instancia PG18temporal54621 detenida; servicio Windows PostgreSQL existente sigue Running. Publicación de aplicación pendiente.
