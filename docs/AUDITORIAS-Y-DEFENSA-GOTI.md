# Reto 2 · Diez auditorías y recorrido para la defensa

El alcance es la tienda MVC, su API y la base relacional. Estas son revisiones internas y reproducibles. Las pruebas funcionales usan datos sintéticos. Puedes abrir cada archivo de la tabla y mostrar las condiciones que comprueba.

| # | Auditoría y prueba | Resultado observado | Límite o condición |
| --- | --- | --- | --- |
| 1 | [Autenticación](../tests/reto2/admin-access.test.cjs) | 4 casos. El alias administrativo inicia sesión, una colisión se rechaza y el cambio de credenciales revoca sesiones. | La contraseña breve elegida para la defensa es fácil de adivinar. Cámbiala al terminar. |
| 2 | [Autorización y privacidad](../tests/reto2/admin-resources.test.cjs) | 5 casos. Los 34 modelos tienen descriptor, la lectura exige administrador y las proyecciones omiten secretos y contactos privados. | La edición usa las operaciones específicas de cada recurso. |
| 3 | [Integridad relacional](../tests/reto2/normalization-migration.test.cjs) | 1 migración de una base anterior con datos. Conservó los vínculos con lotes y los códigos MFA pendientes. | Esta ejecución usa SQLite. La [justificación de las tres formas normales](NORMALIZACION.md) explica claves y dependencias por tabla. |
| 4 | [Búsqueda y precios](../tests/reto2/catalog-search.test.cjs) | 10 casos. Se verificaron filtros, acentos, orden por precio efectivo, paginación y exclusión de inactivos. | La aproximación por errata tiene un límite de candidatos. |
| 5 | [CRUD e inventario](../tests/reto2/product-patch.test.cjs) | 3 casos. Una edición parcial exige rol y versión, conserva los campos omitidos y registra el movimiento correspondiente. | Un conflicto de edición requiere recargar la versión vigente. |
| 6 | [Compra y pago](../tests/reto2/checkout-payment-first.test.cjs) | 4 casos. Antes de completar el pago no se generan pedidos ni comprobantes. Un reintento conserva una sola operación. | El flujo de práctica permite defender la transacción sin efectuar un cobro bancario. |
| 7 | [Órdenes de Goti](../tests/reto2/companion-confirmation.test.cjs) | 10 casos. Se verificaron selección, cancelación, confirmación, sesión expirada y cambio de precio antes de añadir al carrito. | Las consultas informativas con Gemini tienen un endpoint separado, de solo lectura. |
| 8 | [Acceso desde el navegador](../tests/reto2/cross-origin.test.cjs) | 16 casos. Se verificaron orígenes, preflight y rechazo de configuraciones inseguras. | CORS regula al navegador. Los permisos de datos se deciden en el servidor. |
| 9 | [Reparto y seguimiento](../tests/reto2/delivery-progress.test.cjs) | 11 casos. Se verificaron código de entrega, asignación, incidencias, vigencia del GPS y actualización de la ruta. | Las posiciones y el proveedor de rutas son controlados en las pruebas. El seguimiento físico requiere GPS y red. |
| 10 | [Publicación](../tests/reto2/pages-build.test.cjs) | 5 casos. El paquete público incluye las pantallas y su proxy de origen fijo. Se revisó la exclusión de archivos privados y la política de contenido. | Esta prueba genera el artefacto local. El enlace de salud permite comprobar el servicio publicado durante la exposición. |

**Reproducir las diez auditorías.** Desde la raíz y con el proyecto preparado, ejecuta en una sola línea:

```sh
node --test --test-concurrency=1 tests/reto2/admin-access.test.cjs tests/reto2/admin-resources.test.cjs tests/reto2/normalization-migration.test.cjs tests/reto2/catalog-search.test.cjs tests/reto2/product-patch.test.cjs tests/reto2/checkout-payment-first.test.cjs tests/reto2/companion-confirmation.test.cjs tests/reto2/cross-origin.test.cjs tests/reto2/delivery-progress.test.cjs tests/reto2/pages-build.test.cjs
```

En la ejecución de esta revisión pasaron los 69 casos, con cero fallos y cero omisiones. La [prueba específica de Gemini](../tests/reto2/goti-consulta.test.cjs) comprueba el contrato del proveedor con respuestas controladas, el uso del catálogo para los precios y la recuperación ante errores de red, cuota y contenido inesperado.

## Qué abrir y qué decir en siete minutos

| Tiempo | Pantalla | Qué demostrar y cómo explicarlo |
| --- | --- | --- |
| 0:00–1:00 | [Tienda](https://farmacia-reyna-del-cisne-pruebas.pages.dev/) y [Productos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/catalogo) | Busca una referencia disponible y abre su ficha. «El navegador consulta la API con Fetch. Express valida la petición y Prisma recupera los productos activos». |
| 1:00–2:00 | Goti en la misma ficha | Abre **¿Te ayudo? → Modo → Preguntar con Gemini**. Escribe «Ñaño, ¿hasta qué hora atienden y hacen envíos a domicilio?». Después pregunta «¿A cómo sale el gel?». «Gemini interpreta cómo hablamos. El servidor toma los horarios de la farmacia y los precios del catálogo vigente». |
| 2:00–3:00 | [Carrito y compra](https://farmacia-reyna-del-cisne-pruebas.pages.dev/checkout) y [Mis pedidos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/pedidos) | Añade un artículo, recarga y enseña cantidad, imagen y total. Para la compra completa usa la grabación o la instalación local. «El servidor recalcula antes de guardar y evita que un reintento duplique el pedido». |
| 3:00–4:30 | [Ingreso administrativo](https://farmacia-reyna-del-cisne-pruebas.pages.dev/cuenta?next=admin.html) y [Configuración y datos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/admin?tabla=datos) | Muestra Productos y Usuarios. En **Órdenes y ayuda**, escribe «actualizar productos», selecciona uno y cancela. «Una consulta de IA nunca cambia precios. La orden de escritura exige confirmación, rol administrativo y validación del servidor». Para demostrar un guardado, usa la copia local. |
| 4:30–5:30 | [Mis pedidos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/pedidos) | Sigue el mismo pedido desde la confirmación hasta Entregado o Retirado. Recarga y muestra que conserva su etapa. Para los pedidos de práctica el servidor calcula el avance desde la hora registrada del pago. |
| 5:30–6:30 | [Diagrama de la defensa](DEFENSA-RETO-2.md#modelo-relacional-principal), [normalización](NORMALIZACION.md) y [API de productos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/api/productos?pageSize=1) | Sigue un pedido desde la interfaz hasta Pedido y PedidoDetalle. Explica con un ejemplo por qué el precio pagado queda en el detalle aunque mañana cambie el precio del catálogo. |
| 6:30–7:00 | [Salud de la API](https://farmacia-reyna-del-cisne-pruebas.pages.dev/api/salud), [repositorio](https://github.com/elkin2004olmedoch-dotcom/Farmacia-Reyna-del-Cisne) y esta tabla | Enseña una prueba, su resultado y un límite. El plan gratuito de Render puede tardar en despertar. Abre la tienda antes de tu turno. |

**Si preguntan por el diseño.** En MVC la vista muestra los datos, los controladores coordinan la interacción y los modelos concentran el acceso. El carrito usa eventos para avisar a las vistas. Express encadena autenticación, roles y validación. Prisma se reutiliza por módulo. Puedes señalar los ejemplos de código en la [guía técnica](DEFENSA-RETO-2.md#patrones-presentes-y-finalidad).

**Si preguntan por Gemini.** En modo de consulta se envía la pregunta general y el tema anterior. Una clave privada autentica al backend con Google. El modelo elige temas y puede extraer un nombre de producto. El backend acepta un conjunto cerrado de respuestas, consulta productos activos y arma el texto final. Las preguntas clínicas se derivan a atención profesional. Si el proveedor no está disponible, la guía local reconoce las consultas frecuentes. El límite por IP y el presupuesto de 200 llamadas por proceso y por ventana de 24 horas ayudan a controlar consumo. Un reinicio del servicio reinicia ese presupuesto. Las cuotas del proyecto de Google se gestionan en AI Studio.
