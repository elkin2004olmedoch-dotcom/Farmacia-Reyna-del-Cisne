# Plan de arquitectura e identidad

> Ejecución: trabajo paralelo por dominio con revisión de integración y verificación antes de publicar.

**Objetivo:** mejorar los límites de carga y consulta del sistema existente y presentar una experiencia elegante de cuidado personal, con evidencia reproducible.

**Arquitectura:** monolito modular de tres capas, frontend estático separado de la API y persistencia detrás de Prisma. Se conservan los contratos existentes y los datos.

**Stack:** HTML, CSS, JavaScript, Express 5, Prisma 6.19.3, SQLite/PostgreSQL; sin dependencias nuevas.

**Diseño:** [decisiones y restricciones](../specs/2026-10-29-arquitectura-identidad-design.md).

## Restricciones globales

- Conservar identidad vino/crema, logo y mascotas; ningún flotante de WhatsApp.
- Cambiar fuentes y plantillas; regenerar HTML mediante su generador.
- No escribir datos comerciales durante las pruebas ni activar pagos reales.
- No modificar esquemas ni migraciones para resolver problemas de lectura.
- No cambiar contratos de precio, permisos, inventario o privacidad del seguimiento.

## Casos de atención especial

- Sesión administrativa lenta o fallida: productos visibles, acciones de compra ocultas mientras la identidad sea incierta.
- Productos con lotes vencidos, agotados y vigentes alrededor de medianoche de Ecuador: mismo stock vendible y precio.
- Empates de fecha/nombre: páginas con orden definido, sin duplicados en un conjunto estable.
- Puerto ocupado, señales repetidas o conexiones pendientes: cierre acotado, sin limpieza duplicada.
- Móvil estrecho, teclado y textos largos: compra, mascota y controles siguen accesibles.

## Ejecución

- [x] **Base y evidencia:** ejecutar suites existentes sin cargar configuración privada; guardar mediciones anteriores en TEMP y congelar la fuente para comparación.
- [x] **Carga por pantalla** — `frontend/controllers/app.js`, `tests/reto2/performance.spec.cjs`: observar una regresión de descarga de módulos ajenos en la portada; usar importación dinámica mediante mapa cerrado; comprobar catálogo, sesiones y roles. Comparar peticiones y bytes con el mismo perfil. La comprobación entre orígenes exigió una barrera nativa de controles hasta completar la preparación.
- [x] **Lecturas y operación** — modelos de productos/promociones/pedidos/proveedores, `server/app.cjs`, `server/index.cjs` y pruebas focales: reproducir lotes innecesarios, empates y cuota de health; corregir consultas y ciclo de vida con pruebas. No modificar reserva de existencias.
- [x] **Identidad editorial** — `scripts/templates/home.cjs`, `scripts/build-frontend.cjs`, `frontend/assets/shop.css` y HTML generado: portada propia con fotografía real; tipografía, espaciado y tarjetas consistentes. Reutilizar pruebas de accesibilidad y recorridos; tomar capturas de escritorio y móvil.
- [ ] **Integración continua:** conservar estas comprobaciones en `.github/workflows/verify-mvc.yml`, con PostgreSQL y cuentas sintéticas, sin secretos comerciales ni publicación automática. Actualizar la dependencia existente MailKit para corregir los avisos confirmados.
- [ ] **Integración:** ejecutar Node/históricas, PostgreSQL temporal, navegador completo y Pages. Revisar diff, dependencias y límites. Corregir fallos antes de publicar.
- [ ] **Entrega:** actualizar arquitectura y resultados reales, sincronizar la rama de desarrollo existente, publicar en los destinos verificados y comprobar recursos y barreras públicas sin datos válidos.

## Registro de decisiones

- La elección visual procede de la respuesta del propietario: «Experiencia elegante y cuidado personal».
- Las decisiones de implementación son del arquitecto y se mantienen reversibles y dentro del alcance autorizado.
- Se conserva el checkout de desarrollo existente y una copia privada de la fuente previa en TEMP; el directorio de trabajo original no contiene `.git`.
- Los proveedores externos no activados se prueban con simulaciones y se declaran como tales; ninguna suite sustituye una transacción autorizada con una cuenta comercial.
