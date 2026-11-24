# Reto 2 · Informe de auditoría de Farmacia Reina del Cisne

**Objeto de revisión.** Aplicación web MVC de la farmacia, versión utilizada para la defensa del Reto 2. Cada auditoría responde a un criterio de la [rúbrica](REQUISITOS-RETO-2.txt).

**Método.** Se contrastaron la implementación y las pruebas registradas de API, base de datos y navegador. Los casos de compra en Render corresponden al aula. Las mejoras son propuestas para una revisión posterior.

## 1. MVC en el frontend

**Funcionamiento actual**

- El catálogo se divide en modelo, vista y controlador.
- El modelo consulta los productos y la vista construye sus tarjetas.
- El controlador recoge búsquedas, filtros y cambios de página.
- El carrito mantiene las cantidades al pasar del catálogo a la compra.
- La ficha y el catálogo comparten el modelo del carrito.
- Al añadir un artículo, la interfaz anuncia qué producto se agregó.
- Durante la consulta se bloquea el botón para evitar otro clic accidental.

**Evidencia y hallazgos**

- En la prueba de escritorio, buscar «solar» dejó una tarjeta en pantalla.
- Al añadir ese producto, el contador del carrito pasó a una unidad.
- Tras recargar la página, el contador siguió mostrando una unidad.
- Añadir dos unidades desde otra ficha elevó el contador a tres.
- El resumen mostró dos productos distintos con sus cantidades.
- El recorrido también pasó con una ventana de tamaño móvil.
- El controlador del catálogo concentra búsqueda, comparación y actualización de la vista.

**Valoración y mejoras propuestas**

- Conviene probar por separado qué ocurre cuando se combinan varios filtros.
- Un caso útil es volver desde una ficha y comprobar qué filtros se recuperan.
- Otro es agotar la última página al aplicar un filtro más restrictivo.
- Se recomienda probar dos búsquedas seguidas con respuestas en orden inverso.
- La aceptación sería que siempre se vean los resultados de la última búsqueda.
- Estas pruebas permiten decidir qué parte del controlador merece simplificarse.

**Referencias.** [Controlador del catálogo](../src/controllers/catalog.js) y [prueba en navegador](../tests/reto2/frontend.spec.cjs).

## 2. MVC en el backend

**Funcionamiento actual**

- Express recibe la solicitud de compra y la dirige al controlador de pedidos.
- El controlador toma la identidad de la sesión y los datos de entrada validados.
- El modelo consulta precios y existencias antes de registrar la venta.
- Una transacción agrupa el pedido, sus detalles y el ajuste de inventario.
- Cada compra lleva una clave que permite reconocer un intento repetido.
- El controlador decide el estado HTTP según el resultado del modelo.
- El envío del comprobante se gestiona después del registro del pedido.

**Evidencia y hallazgos**

- Se solicitó un pedido de dos unidades con precio unitario de USD 8,50.
- El servidor respondió 201 y la base registró un total de USD 17,00.
- El detalle conservó las dos unidades y el precio utilizado en la venta.
- El inventario pasó de diez unidades a ocho.
- Repetir la petición devolvió 200 y el mismo identificador de pedido.
- Tras la repetición, seguían quedando ocho unidades.
- En otro caso, la falta de stock en una línea revirtió la operación completa.

**Valoración y mejoras propuestas**

- La prioridad es medir cuánto tarda guardar la venta y cuánto tarda el correo.
- El controlador espera el resultado del envío antes de responder al cliente.
- Una demora del proveedor podría alargar una compra que ya se guardó.
- Conviene probar una respuesta lenta del correo con una base temporal.
- Si la demora resulta importante, se puede procesar el aviso en segundo plano.
- La aceptación sería conservar un pedido, un descuento de stock y un aviso trazable.

**Referencias.** [Controlador](../backend/controllers/pedidos.cjs), [modelo](../backend/models/pedidos.cjs) y [pruebas de pedidos](../tests/reto2/api.test.cjs).

## 3. Base de datos relacional y Prisma

**Funcionamiento actual**

- Usuario, Producto, Pedido y PedidoDetalle representan entidades distintas.
- Un cliente puede tener varios pedidos y cada pedido puede reunir varios artículos.
- El detalle vincula cada artículo con su pedido y conserva cantidad y precio.
- El precio guardado en la compra permite reconstruir el importe pagado.
- Prisma dispone de esquemas y migraciones para SQLite y PostgreSQL.
- El aula utiliza SQLite temporal y la aplicación principal utiliza PostgreSQL.
- La normalización documenta claves y dependencias de inventario, lotes y recuperación de cuentas.

**Evidencia y hallazgos**

- La prueba de reconexión recuperó el pedido y sus detalles desde Prisma.
- Cambiar una promoción conservó el descuento registrado en compras anteriores.
- Dar de baja un producto conservó el nombre y el precio de la venta anterior.
- La prueba de migración en PostgreSQL conservó los lotes existentes.
- También conservó los códigos de recuperación al separarlos en filas.
- Se comprobaron restricciones que impiden relacionar registros incompatibles.
- La evidencia cubre las relaciones examinadas y los datos usados en esas migraciones.

**Valoración y mejoras propuestas**

- Conviene revisar cada cambio de esquema con ejemplos de datos anteriores.
- Para cada relación nueva, documentar la clave y qué dependencia justifica la tabla.
- En las copias históricas, explicar qué valor corresponde al momento de la compra.
- Antes de agregar índices, medir los filtros y uniones de uso frecuente.
- Para pedidos, comparar el tiempo de búsqueda por cliente con distintos volúmenes.
- Un ensayo de restauración debe cotejar cantidades, totales y relaciones recuperadas.

**Referencias.** [Normalización](NORMALIZACION.md), [esquema PostgreSQL](../backend/prisma/postgresql/schema.prisma) y [pruebas de migración](../tests/reto2/postgres-normalization.test.cjs).

## 4. API REST de productos

**Funcionamiento actual**

- El catálogo ofrece un listado paginado y una ficha consultable por identificador.
- La consulta pública permite explorar los productos antes de iniciar sesión.
- El administrador puede crear, editar y retirar un producto.
- El servidor valida el precio, las existencias y los campos admitidos.
- La edición detecta conflictos si el registro cambió desde la lectura inicial.
- La baja retira el artículo de las compras futuras.
- Los detalles de ventas anteriores conservan el producto y su precio histórico.

**Evidencia y hallazgos**

- Crear un producto de USD 7,25 con diez unidades devolvió 201.
- La consulta posterior recuperó el registro creado.
- Editar el precio a USD 8,50 devolvió 200 y persistió el cambio.
- Un cambio de stock posterior a la lectura hizo que la edición obsoleta devolviera 409.
- Una solicitud con stock negativo fue rechazada por validación.
- La baja autorizada devolvió 204 y la ficha retirada pasó a devolver 404.
- El historial de venta mantuvo el precio unitario anterior a la baja.

**Valoración y mejoras propuestas**

- Conviene reunir los códigos de respuesta en un contrato breve por operación.
- Para el conflicto 409, indicar al administrador cómo recuperar la versión actual.
- Añadir al contrato un ejemplo de campo inválido con su respuesta esperada.
- Verificar que los filtros devuelvan un orden estable entre páginas.
- Medir el listado con el volumen de productos previsto para el negocio.
- Usar esos resultados para fijar un tamaño de página adecuado para móvil.

**Referencias.** [Rutas](../backend/routes/index.cjs), [casos de API](../tests/reto2/api.test.cjs) y [CRUD desde el navegador](../tests/reto2/frontend.spec.cjs).

## 5. Autenticación JWT y sesión

**Funcionamiento actual**

- La API autentica las credenciales antes de emitir un token firmado.
- El token tiene vencimiento y se comprueban su emisor y su audiencia.
- Una ruta privada necesita una sesión válida para identificar al usuario.
- La aplicación web usa cookies privadas para gestionar su sesión.
- La renovación permite continuar cuando vence el acceso y la sesión sigue vigente.
- El cierre de sesión revoca el acceso anterior.
- La vigencia del usuario también se consulta en la base de datos.

**Evidencia y hallazgos**

- El ingreso correcto del administrador devolvió 200 en la prueba de la API.
- La comprobación verificó la firma y que el vencimiento fuera posterior a la emisión.
- La respuesta de ingreso excluyó la contraseña y su hash.
- La consulta del perfil con el acceso vencido devolvió 401.
- El servidor rechazó tokens con emisor, audiencia o algoritmo incorrectos.
- Cerrar sesión invalidó los tokens anteriores en el caso de revocación.
- La prueba web confirmó que el JWT no se expone al JavaScript de la página.

**Valoración y mejoras propuestas**

- Conviene ensayar la expiración mientras un administrador edita un producto.
- Medir si puede recuperar su trabajo después de autenticarse otra vez.
- Comprobar qué mensaje recibe un cliente si vence la sesión al confirmar la compra.
- El mensaje debería indicar si necesita ingresar de nuevo o consultar sus pedidos.
- En el aula, distinguir las cuentas compartidas de las cuentas personales del negocio.
- Antes de usar datos reales, sustituir los accesos de clase por credenciales individuales.

**Referencias.** [Autenticación](../tests/reto2/api.test.cjs), [controles de tokens](../tests/reto2/security-controls.test.cjs) y [sesión web](../tests/reto2/web-session.test.cjs).

## 6. Autorización por rol y propietario

**Funcionamiento actual**

- La plataforma distingue las operaciones del cliente y del administrador.
- Un visitante puede consultar el catálogo público.
- El cliente autenticado puede comprar y consultar sus propios pedidos.
- La administración tiene permisos para mantener productos y revisar pedidos.
- La API verifica permisos aunque alguien abra directamente una dirección administrativa.
- Las consultas de pedidos tienen en cuenta a quién pertenece la compra.
- La consulta administrativa selecciona los campos que puede devolver.

**Evidencia y hallazgos**

- Se intentó crear el mismo producto con tres situaciones de acceso.
- La petición sin sesión recibió 401 porque faltaba autenticación.
- Con una cuenta de cliente, la petición recibió 403 por falta de permiso.
- Con el administrador, la petición recibió 201 y creó el registro.
- La consulta de pedidos del cliente separó las compras por usuario.
- La consulta administrativa recuperó los pedidos permitidos y excluyó hashes.
- Las pruebas de recursos verificaron el requisito de administrador para las tablas cubiertas.

**Valoración y mejoras propuestas**

- Conviene mantener una matriz de permisos por recurso y operación.
- Incluir parejas de clientes para comprobar también la propiedad de los datos.
- Revisar esa matriz cada vez que se añada una tabla consultable.
- Si hay varios empleados, identificar quién necesita precios, inventario o pedidos.
- Según esas tareas, evaluar permisos más específicos que el rol administrativo completo.
- La aceptación sería que cada empleado pueda cumplir su tarea con los datos mínimos.

**Referencias.** [Pruebas de roles y propiedad](../tests/reto2/api.test.cjs) y [recursos administrativos](../tests/reto2/admin-resources.test.cjs).

## 7. Seguridad básica de la aplicación

**Funcionamiento actual**

- El registro aplica bcrypt antes de persistir la contraseña.
- La API valida campos de cuenta, datos de compra y valores numéricos.
- Los textos de productos pasan por controles antes de guardarse.
- CORS limita los orígenes autorizados para las peticiones del navegador.
- La sesión web usa cookies HttpOnly y controles contra solicitudes falsificadas.
- Los campos privados se excluyen de las respuestas administrativas revisadas.
- Estos controles cubren riesgos distintos de entrada, acceso y exposición de información.

**Evidencia y hallazgos**

- La prueba de registro verificó bcrypt con coste 12 en la base temporal.
- El registro rechazó un correo inválido y un teléfono con formato incorrecto.
- También rechazó que quien se registra intente asignarse un rol administrativo.
- Una edición guardó el nombre del producto como texto limpio.
- Las pruebas de CORS distinguieron orígenes permitidos y no autorizados.
- La prueba web rechazó con 403 un cambio de perfil sin las protecciones exigidas.
- En los errores examinados, las respuestas públicas excluyeron la traza interna.

**Valoración y mejoras propuestas**

- La prioridad operativa es rotar las claves de proveedores compartidas durante el desarrollo.
- Guardar sus reemplazos únicamente en el entorno del servicio que los necesita.
- Comprobar el envío de correo y las funciones autorizadas después de la rotación.
- Revisar qué datos dejan las operaciones administrativas en los registros.
- Repetir las comprobaciones al añadir formularios u orígenes web.
- Registrar la versión examinada para saber a qué entrega corresponde cada resultado.

**Referencias.** [Validación de entradas](../tests/reto2/api.test.cjs), [CORS](../tests/reto2/cross-origin.test.cjs) y [protección de sesión](../tests/reto2/web-session.test.cjs).

## 8. Compra y comunicación entre cliente y servidor

**Funcionamiento actual**

- El navegador usa Fetch para pedir productos y enviar la compra.
- El carrito reúne artículos, imágenes y cantidades antes de confirmar.
- El servidor vuelve a comprobar el importe y las existencias.
- El cliente puede recuperar el pedido desde su cuenta después de recargar.
- La administración consulta el mismo pedido desde su panel.
- El aula admite una dirección escrita de Cuenca para la compra de práctica.
- El seguimiento de clase avanza hasta la entrega dentro de la aplicación.

**Evidencia y hallazgos**

- Cliente y administrador iniciaron sesión simultáneamente en dos sesiones independientes.
- Se añadió Ensure al carrito y la imagen apareció junto al producto.
- El navegador tenía denegado el permiso de ubicación.
- Se indicó Azuay, Cuenca y una dirección escrita para entrega a domicilio.
- El pedido de aula 08c3bc14 registró USD 12,50 de total y USD 0,00 de envío.
- Pasó por Confirmado, En preparación, En camino y Entregado.
- Al recargar, el cliente y el administrador vieron el mismo pedido entregado.

**Valoración y mejoras propuestas**

- El recorrido acredita el flujo de clase con pago y entrega de práctica.
- La operación comercial necesitaría evidencia distinta para cobro bancario y reparto físico.
- Para evaluar la experiencia, conviene medir cuánto tarda cada etapa con red móvil.
- Separar en la medición el primer acceso a Render de las solicitudes posteriores.
- Probar una desconexión justo después de confirmar y antes de recibir la respuesta.
- La recuperación debería mostrar el pedido ya creado y mantener un único cargo cuando haya cobro real.

**Referencias.** [Cliente HTTP](../tests/reto2/api-client.test.cjs), [entregas nacionales](../tests/reto2/national-delivery.test.cjs) y [recorrido del navegador](../tests/reto2/frontend.spec.cjs).

## 9. Accesibilidad y navegación por teclado

**Funcionamiento actual**

- El usuario puede recorrer por teclado catálogo, ficha y carrito.
- La ficha permite ampliar la fotografía desde un control con foco.
- Los cuadros de diálogo admiten cierre y retorno al control de origen.
- El formulario de compra identifica los campos que necesitan corrección.
- El enlace de salto permite llegar directamente al contenido principal.
- Las pruebas combinan interacciones con teclado y comprobaciones automáticas con Axe.
- El alcance incluye pantallas de compra y administración en tamaños de escritorio y móvil.

**Evidencia y hallazgos**

- Enter abrió la imagen ampliada en la ficha de producto.
- Escape cerró la imagen y devolvió el foco al control que la había abierto.
- Los controles de cantidad respondieron al teclado en el caso probado.
- Tras cerrar el carrito, el foco regresó al botón de compra.
- Un documento inválido quedó marcado y recibió el foco para su corrección.
- La navegación del menú móvil devolvió el foco al botón al cerrarlo.
- La suite revisó nueve pantallas con las reglas de Axe configuradas y comprobó su ancho.

**Valoración y mejoras propuestas**

- El resultado automático cubre las reglas ejecutadas, no toda la experiencia de uso.
- La mejora prioritaria es recorrer una compra con una persona que utilice lector de pantalla.
- Escuchar si los cambios de cantidad y total se anuncian en un orden comprensible.
- Probar el formulario ampliando el texto y usando únicamente el teclado.
- Registrar el control exacto y la secuencia de teclas ante cualquier bloqueo.
- Repetir esa secuencia después de corregirlo y conservar el caso como prueba.

**Referencias.** [Casos de teclado](../tests/reto2/customer-accessibility.spec.cjs) y [revisión con Axe](../tests/reto2/frontend.spec.cjs).

## 10. Documentación técnica y entrega

**Funcionamiento actual**

- El README identifica el negocio, su arquitectura y las tecnologías empleadas.
- Describe la instalación y la configuración mediante variables de entorno.
- La estructura distingue la tienda histórica de la aplicación MVC actual.
- La documentación enlaza las rutas, los roles y las reglas de acceso.
- La guía de defensa organiza el recorrido de compra y administración.
- El repositorio conserva la consigna con los criterios del Reto 2.
- La entrega identifica un ZIP descargable con código y configuración de ejemplo.

**Evidencia y hallazgos**

- Se comprobó que el paquete incluye el código y la plantilla de entorno.
- La prueba de empaquetado verificó que se excluyeran variantes de archivos secretos.
- El ZIP verificado contenía 669 entradas y ocupaba 19 564 086 bytes.
- La huella SHA-256 de la descarga coincidió con la del archivo probado.
- Se extrajo el paquete en una carpeta separada para probar la instalación.
- La instalación de dependencias y la preparación de la base finalizaron correctamente.
- En esa extracción se ejecutaron 35 pruebas de API, con 35 aprobadas y cero omisiones.

**Valoración y mejoras propuestas**

- La evidencia del ZIP corresponde al archivo de la defensa identificado por su huella.
- Conviene fechar cada entrega y anotar el commit usado para generar el paquete.
- Distinguir en la portada documental la tienda, el aula temporal y el repositorio.
- Solicitar a otro estudiante que siga la instalación usando solo el README.
- Registrar el primer paso ambiguo y corregirlo con el comando y el resultado esperados.
- Para futuras versiones, repetir extracción, instalación y pruebas antes de publicar el enlace.

**Referencias.** [README](../README.md), [guía de defensa](DEFENSA-RETO-2.md) y [prueba de empaquetado](../tests/reto2/package-security.test.cjs).
