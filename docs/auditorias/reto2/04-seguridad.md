# Punto 4 — Seguridad

## Objetivo, alcance y método

Revisar autenticación, autorización, entradas, transporte y exposición de datos. Se probaron JWT válido, inválido y vencido; user/admin; registro con rol inyectado; documentos, precios y cantidades manipulados; CORS; JSON mal formado; tamaño del cuerpo; logout e historial ajeno. El alcance actual incluye el endpoint del dashboard ERP, su respuesta limitada, la sincronización entre pantallas y los conflictos de edición. La suite Node actual contiene 23 pruebas y pasó. Se ejecutó `npm audit` y se comprobó `/api/salud` por HTTPS con un certificado local; la ampliación de navegador pasó sus 14 casos y su evidencia se registra por separado en el informe 05.

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
| 4.5 Errores consistentes | Middleware único, ID de solicitud, mensaje genérico para fallos internos | Sin stacktrace en respuestas | Implementado |
| 4.6 HTTPS opcional | Certificado self-signed local y servidor HTTPS | HTTP 200 sobre https://localhost:3443/api/salud | Implementado y comprobado en desarrollo |

## Riesgos OWASP y mitigación

La numeración corresponde a [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/). No se declara que la aplicación elimine todos los riesgos de esa lista.

| Riesgo | Amenaza concreta en la farmacia | Mitigación y prueba |
|---|---|---|
| A01 — Broken Access Control | Un cliente crea productos, ve usuarios, consulta pedidos ajenos o accede al resumen global | Roles en servidor; registro rechaza role; identidad tomada de JWT y BD; mis pedidos filtra userId; `/api/admin/resumen` aplica JWT y admin; pruebas 401/403 y segundo usuario sin pedidos |
| A05 — Injection | Entradas introducen SQL, HTML o rutas peligrosas | Prisma parametrizado; tipos/listas/límites; limpieza de texto; escape antes de HTML; imágenes locales existentes; CSP sin scripts inline; pruebas de nombre con etiquetas, imagen javascript e identificador malicioso |
| A07 — Authentication Failures | Contraseña filtrada, token alterado o sesiones que sobreviven al logout | bcrypt 12; secreto privado aleatorio; HS256 explícito, exp/issuer/audience; revocación tokenVersion; límite de intentos; contraseña no aparece en respuestas ni logs; tokens inválidos/vencidos/revocados 401 |

Las prácticas de TLS, entrada validada y cabeceras siguen la orientación de [seguridad de Express](https://expressjs.com/en/advanced/best-practice-security.html). Las sesiones con JWT de 30 minutos y sesión en sessionStorage son una decisión de este proyecto; no se usa cookie de autenticación automática.

## Controles adicionales

- Helmet: CSP, protección contra framing, MIME sniffing y cabeceras de seguridad. HSTS se habilita en producción.
- El backend sirve solo `frontend/`; `.env`, Prisma, base de datos, scripts y dependencias no son contenido estático público.
- `express.json` limita el cuerpo a 32 KB. La API tiene rate limit y auth un límite específico de intentos.
- La API responde `Cache-Control: no-store`. La nueva aplicación no instala el service worker del Reto 1 para evitar stock y permisos cacheados.
- Cédula de registro: no persistida. Documento del pedido: últimos cuatro dígitos, resto enmascarado. No existen campos bancarios en la compra real.
- Los administradores ven datos de entrega necesarios, sin passwordHash ni claves de reintento. Logger sin request body ni Authorization.
- `.env`, archivos SQLite, certificados privados y node_modules se excluyen de Git y del ZIP. `.env.example` no contiene claves reales.

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

## Hallazgos corregidos

1. Dependencia `deepmerge-ts` transitiva de Prisma con alerta de agotamiento de pila: fijada en 8.0.0 mediante override. Generación Prisma, migración, seed y pruebas se ejecutaron con esa versión. `npm audit` final: sin vulnerabilidades reportadas.
2. bcrypt solo utiliza hasta 72 bytes: se limita en registro y login para evitar truncamientos silenciosos.
3. Registro con campos de administración: se rechazan campos no permitidos y se fija role=user en servidor.
4. Pedido manipulado o repetido: total calculado en BD, stock transaccional e idempotencia.
5. Secretos del administrador: setup genera claves aleatorias en archivo privado, no credenciales predeterminadas publicadas.
6. El nuevo resumen administrativo requería el mismo control que las tablas: se protegió con JWT y rol admin y se limitó su selección de campos a la información que necesita el dashboard.
7. Guardar un formulario antiguo podía sobrescribir stock ya descontado: el editor añade control de versión y el backend rechaza cambios concurrentes sin alterar la fila.
8. Repetir la instalación podía restaurar campañas eliminadas: la nueva marca de seed conserva los cambios y la identidad administrativa existente.

## Límites y operación

El certificado self-signed sirve para desarrollo y genera advertencia de confianza en el navegador. Producción requiere un certificado confiable, HTTPS en el origen real y, si se usa reverse proxy, configuración correcta del proxy. El rate limit usa memoria de una instancia; varias instancias necesitarían un almacén común. Un token en sessionStorage sigue siendo accesible a un XSS, por lo que CSP y escape son relevantes pero no sustituyen una revisión de penetración. Recuperación de contraseña, MFA, verificación de correo, gestión de roles y backups operativos no forman parte de los mínimos implementados.
