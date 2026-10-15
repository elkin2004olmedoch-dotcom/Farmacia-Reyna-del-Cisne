# Demostración del Reto 2

Guion de 6–8 minutos para presentar la farmacia y relacionar cada recorrido con la rúbrica. Haz la demostración de escritura y compra en una instalación local con datos sintéticos; la tienda pública contiene datos reales del proyecto.

## Preparar la versión local

En PowerShell, desde la carpeta del proyecto:

```powershell
npm ci
npm run setup
npm start
```

Abre <http://localhost:3000/>. Para entrar al panel, consulta `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el `.env` privado de esa instalación. No los muestres en la grabación ni los subas a GitHub. `npm run setup` inicializa el catálogo de demostración una sola vez; no restablece los cambios ni el stock de una base existente.

## Guion frente al evaluador

1. **Arquitectura y tienda (45 s).** Enseña el catálogo en el navegador y explica que la interfaz separa `models`, `views` y `controllers`, mientras Express organiza `routes`, `controllers`, `models` y `middleware`. La documentación de arquitectura está en [auditoría MVC](auditorias/reto2/01-arquitectura-mvc.md).
2. **Gestión de productos (60 s).** Inicia sesión como administrador, abre Productos y crea un artículo sintético llamado “Producto de demostración”, con precio y stock de prueba. Guarda y enseña que el registro aparece en la tabla. El servidor valida el formulario y persiste el cambio con Prisma.
3. **Permisos (30 s).** Cierra la sesión administrativa e inicia sesión con una cuenta cliente. El cliente puede consultar el catálogo, pero la API le impide crear productos: la respuesta esperada es `403`. La tabla de resultados y la prueba reproducible están en [evidencias de API](pruebas/reto2/README.md).
4. **Compra del cliente (90 s).** En el catálogo agrega el producto sintético al carrito, completa el checkout con datos de prueba y confirma el pedido. Muestra el mensaje de éxito y luego Mis pedidos. El pedido y sus detalles quedan persistidos; la cantidad descuenta stock. Esta demostración no procesa pagos bancarios.
5. **Vista administrativa del pedido (45 s).** Vuelve a entrar como administrador, abre Pedidos y localiza el pedido recién creado. Enseña su detalle y estado. El comprador ve su propio historial; el administrador gestiona todos los pedidos.
6. **Promoción (60 s).** En Promociones crea una campaña de prueba con una vigencia que incluya el momento de la presentación, publícala y enseña el precio efectivo y la promoción en la tienda del cliente. Una vista previa no cambia el precio. Para evitar que el navegador conserve datos anteriores, vuelve al catálogo o recárgalo.
7. **Cierre (30 s).** Abre la [matriz de la rúbrica](REQUISITOS-RETO-2.txt) y la [auditoría del Reto 2](auditorias/reto2/README.md); estas enlazan las evidencias de los diez criterios.

## Verificación automatizada

Desde la raíz del proyecto puedes mostrar los resultados ya registrados en [pruebas del Reto 2](pruebas/reto2/README.md): 136 pruebas Node, 40 recorridos de Chrome y el reporte de `npm audit`. Para volver a ejecutarlos localmente:

```powershell
npm test
npm run test:browser
npm audit
```

La suite usa una base SQLite temporal y no crea pedidos en la tienda pública. La comprobación de autorización también está en `tests/reto2/api.test.cjs` (`crear producto requiere JWT y rol admin; user recibe 403`).

## Cuidado con los datos de prueba

- Usa nombres y datos inventados en la instalación local.
- No hagas una compra de prueba ni publiques una promoción ficticia en la tienda compartida en vivo.
- No ejecutes de nuevo el seed esperando borrar pedidos: el seed conserva cambios administrativos y ventas.
- La tienda no cobra con una pasarela bancaria; el pago y la entrega se coordinan con la farmacia.
- No incluyas `.env`, contraseñas, tokens, datos de clientes ni capturas con información privada en la entrega.
