# Preparación del Reto 2 y revisión de seguridad

La presentación conserva HTML/CSS/JavaScript con MVC, Node.js/Express y Prisma 6. PostgreSQL en Supabase es la persistencia publicada; SQLite permite repetir las pruebas y la instalación local sin tocar pedidos del negocio. No se inició el frontend del Reto 3.

## Correspondencia con el enunciado

| Requisito | Implementación y evidencia reproducible |
| --- | --- |
| MVC en cliente | `frontend/models`, `views`, `controllers`, `assets`; `resources.test.cjs` comprueba la separación entre datos, vistas y eventos. |
| MVC en servidor | `server/routes`, `controllers`, `models`, `middleware`; controladores HTTP separados de Prisma. |
| Persistencia relacional | `Producto`, `Usuario`, `Pedido` y `PedidoDetalle` y sus relaciones, esquemas/migraciones/seed para SQLite y PostgreSQL. `api.test.cjs` verifica registros y detalles persistidos. |
| API CRUD de productos | GET público, POST/PUT/DELETE admin, baja lógica para conservar pedidos; pruebas de API y `frontend.spec.cjs`. |
| Autenticación y roles | JWT Bearer para clientes API y JWT en cookies HttpOnly para la web; admin/user/repartidor comprobados en backend. El registro con correo devuelve 202 y espera confirmación. MFA administrativo opcional añade un desafío antes de entregar sesión. |
| Seguridad OWASP | README explica acceso, criptografía e inyección/XSS; `security-controls.test.cjs`, `web-session.test.cjs`, `admin-mfa.test.cjs`, `cross-origin.test.cjs` y pruebas de validación. |
| Catálogo y carrito | Fetch/async-await, controles reutilizables, localStorage para cantidades; `frontend.spec.cjs`, `cart-drawer.spec.cjs`, `customer-accessibility.spec.cjs`. |
| Login obligatorio y checkout | API privada; el servidor recalcula stock, precio, IVA y tarifa. El checkout de práctica confirma método y total antes de pedido/comprobante; `checkout-payment-first.test.cjs` y configuración específica de `checkout-pay`. |
| Consultas administrativas | Panel de productos, usuarios, pedidos y detalles, con permisos. Nunca se muestra el hash, secretos de MFA ni códigos de recuperación. |
| Accesibilidad | Semántica, labels, ARIA, foco, modales, teclado y adaptación; pruebas de navegador y Axe. `location.spec.cjs` cubre apertura/cierre por teclado del mapa y colores. |
| Errores y logging | Middleware centralizado, requestId, sin stack en respuesta; auditoría administrativa de acciones fijas sin cuerpos ni claves. |
| Entrega | README con ejecución, roles, endpoints y seguridad; `.env.example`; `scripts/crear-reto2.ps1` produce `Reto2_Olmedo_Elkin.zip`. |

La rúbrica y el título aceptan **SQL Server u otro motor relacional**, mientras una frase de la sección 2 dice “debe usar SQL Server”. Se mantiene PostgreSQL conforme a la alternativa expresa de la rúbrica; conviene confirmar esa interpretación con el docente antes de la entrega. No se promete una calificación.

## Ubicación e identidad

El enlace compartido por el titular, `https://maps.app.goo.gl/HrA5J6Q3H4tuExpTA`, redirige al marcador de **Consulab** en Puerto Quito: `0.1200092,-79.2580379`. La longitud del centro visual del mapa (`-79.2629088`) no es la del local. La fuente pública única es `frontend/models/pharmacy.js`; inicio y retiro usan ese mismo punto. No se inventa una dirección de calle ni se muestra un formulario de coordenadas al cliente.

El mapa se carga al abrir **Visítanos** o su enlace de navegación y se descarga al cerrar. Usa `referrerpolicy="no-referrer"`; el enlace externo conserva `noopener noreferrer`. No solicita GPS para localizar la farmacia. Los datos privados de ubicación de un pedido mantienen sus restricciones anteriores.

Se conservan vino `#681e2a`, rojo `#c61025`, rojo oscuro `#920d1d`, crema `#fff3df` y superficie `#fffaf1`. Los tokens compartidos y el color de navegador/manifest evitan diferencias entre la tienda y su instalación. No se modifican logos, fuentes ni mascotas.

## Hallazgos y correcciones de seguridad

### S1 · Alta · Secretos dentro del ZIP de entrega

**Ubicación:** `scripts/crear-reto2.ps1:36`. La expresión anterior no excluía correctamente variantes como `server/.env.production`. Un archivo privado dentro de las carpetas fuente podía terminar en la entrega compartida. La prueba sintética reprodujo el fallo antes de la corrección; no se utilizaron claves reales.

**Corrección:** excluir nombres `.env` y `.env.*` en cualquier carpeta, permitiendo únicamente el `.env.example` de raíz, además de los archivos `.env`, bases, certificados y respaldos ya excluidos. `package-security.test.cjs` comprueba contenido del ZIP y conservación de los originales.

### S2 · Media · Material privado y enlaces fuera del proyecto en la entrega

**Ubicación:** `scripts/crear-reto2.ps1:29` y comprobación de ancestros antes de `CreateEntryFromFile`. El empaquetador recorría carpetas de auditorías privadas aunque Git las ignorase. También faltaba comprobar archivos bajo junctions/enlaces antes de incluirlos.

**Corrección:** excluir `docs/auditorias`, `docs/agentes`, `docs/pruebas` y `docs/superpowers`, `.git`, `.publish` y rutas con reparse points. Se conservan físicamente las auditorías originales y la documentación pública de seguridad. La salida también rechaza enlaces o directorios en lugar del ZIP. Se prepara en un temporal y se publica al terminar. Junctions sintéticas verifican que no se exporten archivos ni se escriba fuera de la salida autorizada.

### Controles existentes preservados

Se revisaron autenticación y revocación, segundo factor, validación de entradas, CORS, CSRF, política de contenidos, límites, subida de imágenes, propietario de pedidos/documentos y verificación de pagos. Se conservan bcrypt 12, JWT con emisor/audiencia/algoritmo/expiración, sesiones rotatorias, cookies HttpOnly/Secure/SameSite, comprobación de rol en API, confirmación de correo, recovery de un uso, consultas Prisma y escape de salida. No se cambian esquemas, filas ni credenciales en esta revisión.

Los pagos comerciales sólo se acreditan después de verificar la respuesta del proveedor; `PagoPractica` continúa separado y marcado sin cobro real. Elegir tarjeta o transferencia no mueve dinero. No se debilitan esos controles para presentar la aplicación.

## Limpieza comprobada

Se comprobaron referencias y las rutas de imagen persistidas en Producto y Promocion mediante consulta de sólo lectura. Se retiran cuatro archivos sin uso en su contexto, con respaldo privado:

- `frontend/assets/images/farmacia-5.jpg`: copia sin consumidor MVC; se conserva la imagen de raíz usada por el Reto 1.
- `frontend/assets/images/farmacia-9.jpg`: copia sin consumidor MVC.
- `frontend/assets/images/farmacia-fachada-reina.webp`: versión antigua sin consumidor; una comprobación obsoleta del build se cambia al logo activo.
- `assets/images/farmacia-9.jpg`: sólo se precargaba en el service worker histórico; se retira esa precarga y se actualiza su caché.

Total retirado del repositorio: **901 325 bytes**. No se promete una mejora de TTFB por retirar archivos que no se solicitaban en la tienda. Se conservan las imágenes guardadas en la base, fuentes, logos, atlas y bases de mascotas, auditorías y recursos aún utilizados por las pruebas del Reto 1. El manifiesto de limpieza y los archivos retirados permanecen en `.publish/cleanup/2026-11-03-reto2/`, fuera de la entrega y de Git.

## Cómo presentar

1. Explicar las tres capas y mostrar una petición Fetch desde el controlador al modelo del cliente y de la API a Prisma.
2. Iniciar sesión como admin, crear/editar un producto y mostrar la baja lógica.
3. Iniciar sesión como cliente y evidenciar HTTP 403 al intentar crear productos con su JWT.
4. Mostrar catálogo, carrito persistente tras recargar, compra autenticada y pedido/detalles guardados; consultar pedidos desde administración.
5. Mostrar JWT, hash no expuesto, validación 422, CORS y tres riesgos OWASP del README.
6. Recorrer formulario, carrito y mapa con teclado; mostrar mensajes de error y estados vacíos.
7. Repetir las pruebas indicadas y entregar el ZIP sin credenciales reales. Mantener accesos del personal fuera del repositorio.

Los logs, capturas y resultados de esta ejecución se guardan en `.publish/reports/2026-11-03-reto2/`. Sólo se afirma un resultado cuando consta en el registro correspondiente; la verificación pública no crea pedidos ni envía correos reales.

Se corrige también el arranque desde una extracción nueva: el ejemplo dejaba correo desactivado pero exigía verificación, bloqueando el registro local con 503. El indicador vacío usa los valores por entorno ya definidos en el backend: desarrollo permite registro local y producción sigue exigiendo verificación. `resources.test.cjs` comprueba ambos casos; no se cambian las variables de Render.

Las pruebas de navegador restablecen su SQLite temporal antes de cada caso, con un endpoint protegido por nonce que sólo registra el servidor de pruebas en loopback. La aplicación de negocio no lo registra y una prueba verifica 404. Esto evita compartir promociones, pedidos, sesiones y presupuestos de intentos entre escenarios. Las comprobaciones de Bearer obtienen JWT por login API; nunca esperan extraerlo de cookies HttpOnly ni de sessionStorage. Usuarios simultáneos usan contextos de navegador separados.

En móvil, Farmi podía tapar «Siguiente» en la última fila de administración. Se reserva espacio inferior para que el botón se pueda desplazar por encima de la mascota. La prueba de facturación pagina mediante un clic normal, conservando Farmi visible. El recorrido de roles usa GPS, geocodificación y transporte OSRM sintéticos en el servidor temporal; las comprobaciones de permisos, pedidos y ruta de la farmacia se ejecutan contra su API real. Esto no acredita navegación en teléfonos físicos.

## Mejoras posteriores a la presentación

Activar PayPhone comercial y probar autorización, cancelación y conciliación; probar GPS con teléfonos Android/iPhone físicos y firma Apple; acordar cobertura logística nacional y horarios reales; definir dominio y correo propios; revisar disponibilidad del hosting gratuito y límites compartidos antes de escalar a varias instancias. Estos pasos no forman parte de los mínimos académicos de este Reto 2. El Reto 3 espera el framework asignado.
