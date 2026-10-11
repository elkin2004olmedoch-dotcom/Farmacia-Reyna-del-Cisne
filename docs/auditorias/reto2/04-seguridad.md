# Punto 4 — Seguridad

## Objetivo, alcance y método

Revisar autenticación, autorización, entradas, transporte, exposición de datos e integridad. Se probaron JWT inválido/vencido/revocado, roles, registro manipulado, documentos/precios/cantidades, CORS, cuerpos y errores. El alcance incluye dashboard, ediciones concurrentes, cambios de estado, descuentos, carga de imágenes y recuperación. Las ejecuciones completas y `npm audit` se conservan en `docs/pruebas/reto2/`; HTTPS local se comprobó mediante `/api/salud`.

La opción Render/Supabase incorpora controles de configuración, RLS y almacenamiento. La suite repetible usa SQLite real temporal y simulaciones para aislar servicios externos. La conexión real a Supabase y el traslado ya se completaron: RLS está habilitado sin políticas públicas en las siete tablas de farmacia y `_prisma_migrations`, y la comparación del traslado confirmó los hashes de credenciales intactos. Las 17 comprobaciones puntuales de Express local contra PostgreSQL/Storage reales incluyeron login del administrador conservado, registro/login de cliente, permisos 401/403 y carga de imágenes protegida.

[Render Free](https://farmacia-reina-del-cisne.onrender.com) ya está activo por HTTPS. Las 16 comprobaciones de API pública incluyeron autenticación, autorización por rol y operación de imágenes protegida; en navegador se verificaron el acceso administrativo al Dashboard ERP y el acceso del cliente a su pedido. El reinicio real conservó registros, imágenes con SHA-256 idéntico, login de ambos roles, pedido histórico cancelado y edición de producto. Se retiraron únicamente los datos sintéticos y sus dos imágenes; la comparación final confirmó las siete tablas y la imagen original íntegramente iguales al origen, incluidos los hashes de credenciales. Son comprobaciones funcionales, de permisos e integridad, no una prueba de penetración ni una certificación de seguridad. El [alcance de nube](../../pruebas/reto2/nube.json) conserva los resultados reales, separados de los aislados y de la verificación previa desde el equipo local.

## Matriz de subpuntos

| Requisito | Control concreto | Evidencia | Resultado |
|---|---|---|---|
| 4.1 Tres riesgos OWASP en README | A01:2025 acceso roto, A05:2025 inyección, A07:2025 autenticación | Matriz de mitigación y fuentes oficiales | Documentado e implementado |
| 4.2 JWT Bearer | Firma HS256, emisor/audiencia, vencimiento y secreto de 48 bytes aleatorios en setup | Login devuelve JWT; tokens inválidos/vencidos 401 | Implementado |
| 4.2 Rutas por rol | JWT identifica al usuario; rol/activo se vuelven a consultar en BD | User 403 para CRUD, panel, pedidos globales y `/api/admin/resumen`; sin sesión, resumen 401 | Implementado |
| 4.3 CORS seguro | Lista exacta CORS_ORIGIN, sin `*`, preflight y métodos/cabeceras explícitos | Origen admitido recibe su cabecera; ajeno recibe 403 | Implementado |
| 4.4 bcrypt | Coste 12, sal por contraseña, límite de 72 bytes y validación de longitud/letra/número | Prueba compara hash y verifica que no sea texto plano | Implementado |
| 4.5 Body y params | express-validator, lista de campos, tipos, longitudes, rutas de imagen y sanitización | Entradas inválidas 422; JSON inválido 400 | Implementado |
| Consistencia de edición | `esperadoUpdatedAt` validado y comparación atómica de versión en Producto | Compra/edición intermedia provoca 409 sin restaurar stock vendido | Implementado para las ediciones del frontend |
| Estados y stock | JWT admin, versión obligatoria, transiciones y transacción CAS | 401/403, terminales, doble cancelación con una sola devolución e historial | Implementado |
| Imágenes subidas | JWT/rol antes de parser 3 MB, validación binaria y recodificación WebP | SVG/formato falso/ruta/tamaño/dimensiones rechazados | Implementado |
| Recuperación | Copia consistente, manifiesto SHA-256, integridad/FK, servidor detenido y respaldo previo | Restauración temporal, modificación de archivo y proceso activo | Implementado por CLI |
| 4.5 Errores consistentes | Middleware único, ID de solicitud, mensaje genérico para fallos internos | Sin stacktrace en respuestas | Implementado |
| 4.6 HTTPS opcional | Certificado self-signed local y servidor HTTPS | HTTP 200 sobre https://localhost:3443/api/salud | Implementado y comprobado en desarrollo |

## Riesgos OWASP y mitigación

La numeración corresponde a [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/). No se declara que la aplicación elimine todos los riesgos de esa lista.

| Riesgo | Amenaza concreta en la farmacia | Mitigación y prueba |
|---|---|---|
| A01 — Broken Access Control | Un cliente crea productos, ve usuarios, consulta pedidos ajenos o accede al resumen global | Roles en servidor; registro rechaza role; identidad tomada de JWT y BD; mis pedidos filtra userId; `/api/admin/resumen` aplica JWT y admin; pruebas 401/403 y segundo usuario sin pedidos |
| A05 — Injection | Entradas introducen SQL, HTML o rutas peligrosas | Prisma parametrizado; tipos/listas/límites; limpieza de texto; escape antes de HTML; referencias de imagen canónicas verificadas en disco o Storage; CSP sin scripts inline; pruebas de nombre con etiquetas, imagen javascript e identificador malicioso |
| A07 — Authentication Failures | Contraseña filtrada, token alterado o sesiones que sobreviven al logout | bcrypt 12; secreto privado aleatorio; HS256 explícito, exp/issuer/audience; revocación tokenVersion; límite de intentos; contraseña no aparece en respuestas ni logs; tokens inválidos/vencidos/revocados 401 |

Las prácticas de TLS, entrada validada y cabeceras siguen la orientación de [seguridad de Express](https://expressjs.com/en/advanced/best-practice-security.html). Las sesiones con JWT de 30 minutos y sesión en sessionStorage son una decisión de este proyecto; no se usa cookie de autenticación automática.

## Controles adicionales

- Helmet: CSP, protección contra framing, MIME sniffing y cabeceras de seguridad. HSTS se habilita en producción.
- El backend sirve solo `frontend/`; `.env`, Prisma, base de datos, scripts y dependencias no son contenido estático público.
- `express.json` limita el cuerpo general a 32 KB. La subida tiene parser de 3 MB solo después de JWT/rol; rate limit propio 10/min y máximo dos imágenes procesándose por instancia. Auth conserva su límite específico.
- La API responde `Cache-Control: no-store`. La nueva aplicación no instala el service worker del Reto 1 para evitar stock y permisos cacheados.
- Cédula de registro: no persistida. Documento del pedido: últimos cuatro dígitos, resto enmascarado. No existen campos bancarios en la compra real.
- Los administradores ven datos de entrega necesarios, sin passwordHash ni claves de reintento. Logger sin request body ni Authorization.
- Configuración privada, SQLite, certificados, node_modules, `server/backups/` e imágenes UUID de trabajo se excluyen de Git y ZIP. El archivo de configuración de ejemplo no contiene claves reales.
- DATABASE_URL, JWT_SECRET y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY heredada) se configuran solo en el entorno privado del servidor; no se envían al navegador ni se incorporan a Git o ZIP. La migración PostgreSQL aplicada habilitó RLS sin políticas de acceso público en las siete tablas de farmacia y `_prisma_migrations`.
- El bucket público de Supabase se reserva para imágenes WebP. Las cuentas, hashes y pedidos permanecen en PostgreSQL privado; las escrituras de imágenes pasan por Express con JWT/rol y una clave de servidor, sin sobrescribir UUID.

## Controles del dashboard y separación de roles

`GET /api/admin/resumen` aplica los middleware de autenticación y rol admin antes del controlador. La ruta devuelve 401 sin JWT válido y 403 a una cuenta de cliente; ocultar el sidebar o cambiar la URL del navegador no otorga acceso. Se conserva la autorización en cada consulta al servidor.

El resumen expone conteos e importes agregados, productos en alerta y hasta cinco pedidos recientes. Cada pedido reciente contiene solamente ID, nombre del comprador, importe en centavos, estado y fecha. No incluye correo, teléfono, dirección, documento, hash de contraseña ni clave de idempotencia del cliente. La identidad del administrador mostrada en el sidebar procede de su propia sesión autenticada.

`frontend/views/admin-dashboard.js` escapa nombres, estados, etiquetas y descripciones antes de generar HTML o SVG. La gráfica usa atributos SVG y clases CSS; no necesita scripts ni atributos `style` inline, por lo que conserva la política CSP vigente. Los importes de pedidos se describen como pedidos registrados y no como cobros confirmados.

El panel tiene cabecera, sidebar y enlaces propios. Al iniciar sesión como administrador se abre el dashboard; las rutas de carrito e historial personal redirigen al panel administrativo. Esta separación del recorrido visual complementa los permisos del backend y conserva el contrato previo de la API de pedidos.

En móvil, menú y overlay comparten el estado de apertura y se cierran por Escape, selección de enlace, clic en el overlay o cambio al tamaño de escritorio. Ante una sesión vencida en el panel, el controlador oculta y vacía `#admin-area`, cierra los diálogos y la navegación y dirige al acceso. El borrado retira del DOM la información administrativa que ya se había mostrado.

La señal de cambios entre pestañas guarda únicamente un UUID aleatorio en `farmacia-mvc-datos-actualizados`. No comparte JWT, usuarios, documentos ni pedidos. Cada refresco usa los mismos endpoints y vuelve a pasar por JWT y rol; la señal de almacenamiento no constituye autorización. Las sesiones siguen en sessionStorage y se mantienen separadas por pestaña; los pedidos personales se filtran por la identidad autenticada en el servidor.

El frontend conserva la versión de un producto al abrir su editor y la envía como `esperadoUpdatedAt`. El servidor valida fecha ISO con zona horaria y limita el campo al PUT, sin persistirlo como dato del producto. El `updateMany` condicionado por versión evita sobrescribir stock modificado por una compra o por otra sesión administrativa. Un 409 conserva el formulario y explica que debe abrirse de nuevo con los datos actuales. El campo es opcional para compatibilidad de la API; la protección no se aplica si un consumidor externo lo omite.

Las consultas automáticas no realizan mutaciones ni envían formularios. Se posponen cuando hay un editor o una confirmación abiertos, o durante el envío del pedido; el carrito mantiene las cantidades y los datos ingresados aunque el servidor anuncie stock insuficiente. La marca de Semilla evita que repetir setup reponga campañas eliminadas o stock vendido y no eleva automáticamente un correo de cliente a administrador.

El editor asigna su registro e ID únicamente después de confirmar que la apertura asíncrona sigue siendo la más reciente y conserva la sección y sesión administrativas. Esto evita que consultas retrasadas de opciones de campaña produzcan una edición sobre un ID diferente al mostrado.

## Controles de comercio, imágenes y recuperación

Cambiar estado exige administrador y `esperadoUpdatedAt`; la transición válida se comprueba de nuevo en una transacción Serializable. La actualización es condicional por ID/estado/versión. Cancelar repone stock y escribe el evento con actor en esa transacción; un reintento no produce otra reposición. El cliente no puede gestionar estados ni enviar precios/descuentos en el carrito. El porcentaje válido se obtiene de productos persistidos y campañas vigentes, fuera de vista previa; se aplica el mayor sin sumarlos y hasta 85 %.

La ruta de imágenes autentica y verifica rol antes de analizar el cuerpo grande. Comprueba base64, extensión y firma, decodifica con Sharp, limita píxeles/dimensiones y rechaza animación. Se recodifica como WebP sin metadatos con nombre UUID nuevo, sin sobrescribir archivos. La referencia persistida debe cumplir el patrón canónico y existir: en modo local resuelve dentro de la carpeta autorizada; en nube se comprueba en Supabase Storage. Una promoción con imagen propia exige texto alternativo. La validación del frontend mejora el mensaje, pero el servidor vuelve a comprobar todo.

Las copias se guardan fuera del contenido estático y no tienen endpoint de descarga/restauración. El archivo SQLite incluye hashes de contraseñas y datos operativos: debe conservarse privado como la base original. Se validan tamaños y SHA-256 contra el manifiesto, firma SQLite, integridad y referencias antes de restaurar. SHA-256 detecta cambios respecto al manifiesto; no es una firma de autenticidad ni cifrado. La restauración requiere `--offline`, ausencia de servidor registrado activo y, para reemplazar una base, `--replace` con respaldo previo. No se publican copias ni credenciales en la entrega.

## Hallazgos corregidos

1. Dependencia `deepmerge-ts` transitiva de Prisma con alerta de agotamiento de pila: fijada en 8.0.0 mediante override. Generación, migración, seed y pruebas usan esa versión. La salida de `npm audit` de la ejecución final se conserva como evidencia; no demuestra ausencia de cualquier vulnerabilidad.
2. bcrypt solo utiliza hasta 72 bytes: se limita en registro y login para evitar truncamientos silenciosos.
3. Registro con campos de administración: se rechazan campos no permitidos y se fija role=user en servidor.
4. Pedido manipulado o repetido: total calculado en BD, stock transaccional e idempotencia.
5. Secretos del administrador: setup genera claves aleatorias en archivo privado, no credenciales predeterminadas publicadas.
6. El nuevo resumen administrativo requería el mismo control que las tablas: se protegió con JWT y rol admin y se limitó su selección de campos a la información que necesita el dashboard.
7. Guardar un formulario antiguo podía sobrescribir stock ya descontado: el editor añade control de versión y el backend rechaza cambios concurrentes sin alterar la fila.
8. Repetir la instalación podía restaurar campañas eliminadas: la nueva marca de seed conserva los cambios y la identidad administrativa existente.

## Límites y operación

El certificado self-signed sirve para desarrollo y genera advertencia de confianza. Producción requiere certificado confiable, origen HTTPS y configuración de proxy cuando corresponda. Los límites usan memoria por instancia; varias instancias requieren un almacén común. SessionStorage sigue accesible ante XSS. No hay recuperación de contraseña, MFA, verificación de correo ni gestión de roles. El backup implementado es local y exige operación privada: no incluye cifrado, firma digital, copia externa ni garantía frente a pérdida del disco. La comprobación offline reconoce los servidores registrados por esta aplicación; el operador debe detener también otros procesos que escriban en la base.


## Seguridad de los nuevos módulos

Proveedor, lotes, ajustes, tarifas, configuración del emisor y emisión exigen JWT/administrador en servidor. Los porcentajes y existencias tienen validación de interfaz/API y restricciones SQL. Los formularios no permiten concederse roles. Cédula verifica formato y dígito; RUC valida estructura sin imponer un algoritmo empresarial que SRI no exige, ni afirmar inscripción real.

Certificado y contraseña se cifran con AES-256-GCM, clave HKDF separada por dominio, sal e IV aleatorios; respuestas/listados/logs no incluyen material privado. La contraseña de importación viaja a OpenSSL por entorno del proceso hijo y PKCS12 por stdin; sin PEM privado en disco de operación. Entradas base64 canónicas, límite exacto 2 MiB, tiempo/memoria acotados, RSA 2048+, correspondencia clave/certificado y vencimiento. No se utilizó la dependencia vulnerable node-forge. Firma y alteración se verifican criptográficamente; XML limita tamaño y rechaza DTD/entidades; SOAP usa únicamente endpoints HTTPS oficiales sin redirecciones.

XML/RIDE sólo para administrador o dueño del pedido. La identificación completa necesaria para factura vive en snapshot privado; los listados la enmascaran. Cambiar el RUC retira la firma anterior. Certificado, contraseña y archivos P12/PFX/PEM/KEY se excluyen de Git/ZIP. Los campos del navegador se vacían al terminar; esto no promete borrado criptográfico de memoria JavaScript.

Todas las tablas PostgreSQL, incluidas las 15 entidades y _prisma_migrations, requieren RLS sin políticas públicas; el servidor utiliza credenciales privadas. Las pruebas temporales pueden aumentar cuotas sólo fuera de producción, y se verifica que producción siga limitada. Evidencia: rate-limits.test.cjs, production.test.cjs, sri-api.test.cjs, sri-crypto.test.cjs y npm-audit.json. La confianza y autorización real del emisor requieren pruebas con su firma ante SRI, no un certificado sintético.
