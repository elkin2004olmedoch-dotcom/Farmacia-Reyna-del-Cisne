# Publicar la farmacia completa: Render y Supabase

Comprobación histórica del 11 de octubre de 2026: **la [farmacia en línea](https://farmacia-reina-del-cisne.onrender.com/) quedó activa en Render Free con PostgreSQL/Storage reales de Supabase**. El administrador, 18 productos, dos promociones y una foto fueron trasladados conservando registros y hash de la imagen. Se comprobaron la API pública, los recorridos de ambos roles y la persistencia después de reiniciar Render. Los datos sintéticos fueron retirados; los originales se conservaron. `data/deployment.json` conserva el origen de Render.

Último estado documentado, del 21 de octubre de 2026: [Cloudflare Pages de prueba](https://farmacia-reyna-del-cisne-pruebas.pages.dev/) sirve el frontend MVC `0672e41` y consulta la API existente de Render, que conserva `75aee3e` y Auto-Deploy Off. GitHub Pages publica la tienda estática histórica independiente, sin redirección automática a Render. Esta actualización documental no verifica el estado remoto actual; consulta [la configuración y reversión de Pages y Render](DEPLOY_CLOUDFLARE.md).

Clientes y administrador pueden utilizar [el mismo enlace de Render](https://farmacia-reina-del-cisne.onrender.com/). Abre [Ingresar](https://farmacia-reina-del-cisne.onrender.com/cuenta.html): la cuenta administrativa conservada llega al dashboard; los clientes usan “Crear cuenta” y consultan sus propios pedidos. Edita productos, fotos y promociones desde el panel en línea para compartirlos con todos. GitHub Pages no ejecuta Express ni comparte cuentas, pedidos o carrito con la aplicación MVC. Las cuentas de demostración del antiguo navegador son distintas de las cuentas MVC.

## 1. Crear el proyecto gratuito de Supabase

1. Entra a [Supabase](https://supabase.com/dashboard) con tu cuenta de GitHub y crea un proyecto en una organización **Free**. Conserva la contraseña de la base de datos de forma privada.
2. En **Connect**, elige PostgreSQL **Session pooler**, puerto **5432**, compatible con IPv4. Copia la conexión como `DATABASE_URL`; sustituye la contraseña codificada y añade `sslmode=require&connection_limit=2` a la consulta de la URL. No uses el transaction pooler del puerto 6543 para las migraciones.
3. Obtén el **Project URL** (`https://<proyecto>.supabase.co`) y una **Secret key** (`sb_secret_...`) desde **Settings > API Keys**. Guárdala como `SUPABASE_SECRET_KEY` solo en el servidor, nunca en HTML, JavaScript del navegador, GitHub, capturas o mensajes. El adaptador la envía en `apikey`, sin `Authorization: Bearer`, porque no es un JWT. Para instalaciones anteriores conserva el respaldo `SUPABASE_SERVICE_ROLE_KEY` con la clave heredada `service_role`; si configuras ambas, la Secret key tiene prioridad. No uses una Publishable key. [Documentación oficial de claves](https://supabase.com/docs/guides/getting-started/api-keys).
4. En **Storage**, crea un bucket público llamado `farmaciaproductos`. Solo contiene fotos públicas de productos/promociones. El backend valida/reconvierte las imágenes, autentica al administrador y escribe usando la clave privada. No crees políticas que permitan escritura anónima.

Las migraciones PostgreSQL habilitan RLS en todas las tablas de la farmacia y en `_prisma_migrations`, sin políticas públicas. Express accede con la conexión privada del servidor; las cuentas, hashes y pedidos no se publican mediante la API anónima de Supabase.

## 2. Crear el servicio gratuito de Render

1. Entra a [Render](https://dashboard.render.com/). Puedes crear un **Web Service** usando la URL pública de este repositorio, rama `main`, región Virginia, build `npm ci --include=dev && npm run setup:production`, inicio `npm start` y health check `/api/salud`; importa las variables mediante el formulario privado. También está disponible el **Blueprint histórico** `render.yaml`, con las diferencias indicadas a continuación. Comprueba que el servicio indique **Free ($0/mes)**. No crees base de datos ni disco de pago en Render. En la cuenta utilizada, desplegar Free abrió el formulario **Add Card** con una autorización temporal de USD 1; ese paso lo completa el titular. [Verificación de tarjeta](https://render.com/pricing).
2. Configura los valores privados solicitados:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Conexión privada PostgreSQL Session pooler con SSL |
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SECRET_KEY` | Secret key privada `sb_secret_...` |
| `ADMIN_EMAIL` | Correo de la cuenta administradora que se conservará/importará |
| `ADMIN_PASSWORD` | Contraseña privada: mínimo 10 caracteres, letra y número, máximo 72 bytes |

`JWT_SECRET` se genera en Render con Blueprint, o se prepara aleatoriamente y se importa de forma privada para un Web Service manual. El blueprint fija `NODE_ENV=production`, `HOST=0.0.0.0`, `IMAGE_STORAGE=supabase`, bucket `farmaciaproductos` y `SKIP_INITIAL_SEED=true`. El `PORT` y `RENDER_EXTERNAL_URL` los asigna Render. CORS usa el origen HTTPS del servicio por defecto; si necesitas otros clientes, configura `CORS_ORIGIN` con orígenes HTTPS exactos separados por comas. Si ya usas una clave heredada, deja `SUPABASE_SECRET_KEY` vacía y agrega `SUPABASE_SERVICE_ROLE_KEY` como secreto privado en el servicio.

`render.yaml` no reproduce el panel documentado el 21 de octubre: configura `autoDeployTrigger: commit` y CORS solo para Render, mientras el servicio conserva Auto-Deploy Off y los orígenes exactos de Render y Pages de prueba. No reapliques el Blueprint al servicio existente como una actualización rutinaria; revisa [las diferencias y el procedimiento controlado](DEPLOY_CLOUDFLARE.md#render-existente).

3. Ejecuta el despliegue. La compilación genera el cliente Prisma PostgreSQL independiente y aplica las migraciones. El seed se omite inicialmente para poder trasladar tu base local a una base vacía. Si vas a importar datos, conserva el enlace sin compartir hasta terminar el traslado: registrar usuarios antes haría que el destino ya no estuviera vacío y la importación se rechazaría para proteger esos registros.

## 3. Conservar las cuentas, pedidos y fotos locales

No subas `farmacia.db`, `.env`, copias de seguridad ni la carpeta de uploads al repositorio público. El traslado se hace directamente a tus servicios privados.

1. Detén temporalmente los cambios del administrador y los pedidos en la aplicación local para que la copia final represente un estado estable. Conserva un respaldo local con `npm run backup`.
2. En una terminal privada local configura `TARGET_DATABASE_URL` con la conexión de destino. La fuente se toma de `SOURCE_DATABASE_URL` o de la `DATABASE_URL` SQLite de tu `.env`. Configura también `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (o el respaldo heredado `SUPABASE_SERVICE_ROLE_KEY`), `SUPABASE_STORAGE_BUCKET` e `IMAGE_STORAGE=supabase` para trasladar las fotos subidas. No reemplaces la `DATABASE_URL` local por la URL PostgreSQL.
3. Genera el cliente opcional y comprueba el traslado sin escribir:

```sh
npm run db:generate:postgres
node scripts/migrate-cloud.cjs
```

4. Revisa los conteos; el destino debe estar vacío. Luego aplica explícitamente:

```sh
node scripts/migrate-cloud.cjs --apply
```

El traslado conserva IDs, hashes de contraseña, fechas, catálogo, promociones, pedidos, detalles e historial. Sube las fotos con sus nombres originales y prohíbe sobrescribirlas. Los registros se importan en una transacción. Una falla puede dejar objetos de imagen sin referencias, pero no se informa éxito ni se importa parcialmente la base. Si el destino ya tiene datos, no se borra ni se mezcla automáticamente.

5. La instalación actual conserva `SKIP_INITIAL_SEED=true` porque ya tiene el administrador y catálogo importados. No necesita ejecutar seed en cada despliegue. En otra instalación que empiece vacía, omite el traslado y cambia esa variable a `false`; el seed respeta los datos existentes.

Las cuentas de `localStorage` de la antigua demostración estática no se importan: no corresponden a usuarios MVC. Para usar los datos compartidos, abre el enlace público tanto como administrador como cliente. Editar una SQLite local independiente no modifica la base en internet.

## 4. Comprobaciones y configuración histórica opcional de GitHub

La instalación del 11 de octubre incluyó estas comprobaciones, conservadas como antecedente:

1. Se comprobó `/api/salud`, la sesión con una cuenta importada y los datos del panel administrador.
2. Se comprobaron imágenes/promociones, registro, pedidos, stock y transiciones de estado.
3. Se comprobó la persistencia de usuarios, fotos y pedidos después del reinicio de Render.

El siguiente comando pertenece a la configuración histórica opcional del enlace hacia Render; **no debe ejecutarse para la publicación actual**:

```sh
node scripts/configure-public-site.cjs https://TU-SERVICIO.onrender.com
```

El script modifica `data/deployment.json` y la versión de caché de `service-worker.js`; no activa por sí solo una redirección. Los HTML históricos actuales no cargan `js/live-site.js` y conservan la tienda estática. La publicación MVC de prueba en Cloudflare Pages utiliza `scripts/build-pages.cjs` y su configuración pública de API e imágenes, según [la guía vigente documentada](DEPLOY_CLOUDFLARE.md); no requiere ejecutar `configure-public-site.cjs` ni sustituir la tienda de GitHub Pages.

## Límites y respaldos

Render Free suspende el servidor después de 15 minutos sin tráfico; el siguiente acceso puede tardar aproximadamente un minuto. Supabase Free puede pausar el proyecto tras una semana con poca actividad. Estos planes permiten conservar un enlace y datos con límites, **sin garantizar disponibilidad continua**. Las cuentas y el bucket gratuito ya fueron creados y los datos se trasladaron directamente a Supabase; no se han contratado planes de pago. Si agregas una tarjeta, Render puede facturar excesos de transferencia o minutos de compilación; revisa sus límites de uso y el límite de gasto de compilación. [Condiciones de facturación de instancias gratuitas](https://render.com/docs/faq#all-of-my-services-run-on-free-instances-can-i-still-be-billed).

Render Free tiene almacenamiento efímero: por eso esta configuración guarda PostgreSQL e imágenes en Supabase. Los respaldos SQLite automáticos siguen funcionando localmente; en PostgreSQL se omiten y el servidor avisa que debes respaldar el servicio alojado. Supabase Free no incluye backups automáticos: exporta la base con `pg_dump` o las herramientas del proveedor y copia también los objetos de Storage. Una copia de la base no incluye las fotos de Storage.

Fuentes oficiales: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Render Free](https://render.com/docs/free), [Supabase Free](https://supabase.com/pricing), [Prisma y Supabase](https://supabase.com/docs/guides/database/prisma), [Supabase Storage](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [pausas](https://supabase.com/docs/guides/platform/free-project-pausing), [respaldos](https://supabase.com/docs/guides/platform/backups).
