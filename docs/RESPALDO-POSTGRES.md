# Respaldo PostgreSQL previo a 018 y 019

`scripts/snapshot-postgres.cjs` conserva una copia lógica cifrada antes de aplicar las migraciones de normalización. `setup:production` lo ejecuta después de generar el cliente PostgreSQL y antes de migrar, cuando está configurada `MIGRATION_BACKUP_KEY`. Un error de configuración, lectura, cifrado, almacenamiento o verificación detiene la preparación.

La clave debe contener exactamente 32 bytes aleatorios en base64 canónico. Se configura únicamente en el entorno privado del servidor y se conserva por separado del objeto cifrado. `POSTGRES_BACKUP_BUCKET` identifica un bucket privado distinto del de imágenes; el valor predeterminado es `farmacia-respaldos`. Se reutilizan `SUPABASE_URL` y `SUPABASE_SECRET_KEY` del servidor. Ninguna de estas claves debe entrar en Git, informes, capturas ni ZIP de entrega.

Si no se informa ninguna variable de activación, se omite el respaldo. Un bucket configurado sin clave o cualquier valor inválido falla. El destino exige el origen HTTPS oficial del proyecto Supabase y una clave moderna `sb_secret_…`. Sólo se envía mediante la cabecera `apikey`, conforme a la [documentación oficial de claves](https://supabase.com/docs/guides/getting-started/api-keys).

## Contenido y consistencia

La transacción PostgreSQL es `RepeatableRead` y de sólo lectura. Incluye todas las tablas existentes de `public` reconocidas por los modelos Prisma, además de `_prisma_migrations`; rechaza tablas desconocidas o una base sin historial de migraciones. Puede leer las columnas anteriores aunque el cliente generado ya describa el esquema nuevo. Si la migración `202611230019_relational_normalization` terminó correctamente, devuelve `already-applied` sin contactar Storage.

Cada fila se guarda como texto obtenido con `row_to_json(t)::text`. Los números de las filas no se convierten a `Number` de JavaScript. El contenedor incluye versión, proveedor, fecha, filas por tabla y sus conteos. Se limita a 64 MiB de contenido serializado; una base mayor detiene este mecanismo y requiere otro procedimiento de respaldo.

El contenido se cifra en memoria con AES-256-GCM y un IV aleatorio de 12 bytes. El formato binario contiene la marca `FRCPG019` seguida de un byte cero, el IV, la etiqueta GCM de 16 bytes y el contenido cifrado. La marca también se autentica. No se escribe una copia local en texto plano.

## Almacenamiento y verificación

Se consulta el bucket y se exige `public:false`. Sólo se crea cuando Storage devuelve una ausencia estructurada exacta: HTTP 400 o 404, `statusCode` 404 y los campos `error` y `message` iguales a `Bucket not found`. Su respuesta JSON está limitada a 8 KiB. Un error de permisos o un 404 genérico no autoriza crear el bucket. Este caso se corresponde con la [definición oficial de NoSuchBucket](https://github.com/supabase/storage/blob/master/src/internal/errors/codes.ts).

La carga usa un nombre nuevo `019-fecha-UUID.bin` y prohíbe sobrescribir. Después descarga el objeto por el endpoint autenticado, compara el SHA-256 del contenido cifrado, descifra y comprueba las filas y los conteos. Sólo entonces informa bucket, objeto y conteos. Las respuestas de error del proveedor y los datos de las filas no se imprimen. Los endpoints siguen la [referencia REST de Storage](https://supabase.com/docs/reference/self-hosting-storage/get-details-of-a-bucket) y la [guía de descarga privada](https://supabase.com/docs/guides/storage/serving/downloads).

## Recuperación y límites

El objeto conserva datos, incluidos los valores anteriores de `loteId` y `recoveryHashes`; no contiene DDL, archivos de imágenes ni objetos de otros esquemas de PostgreSQL. El esquema anterior se conserva en las migraciones versionadas. El módulo exporta `decryptSnapshot(bytes, key)` para recuperar el contenedor con la clave original. El código de restauración SQLite no acepta este formato PostgreSQL.

Una recuperación debe prepararse en otra base PostgreSQL con el esquema correspondiente al historial del objeto. Las filas textuales permiten una importación tipada mediante PostgreSQL sin pasar los números por JavaScript. Antes de sustituir la base activa deben comprobarse conteos, claves foráneas, relaciones y acceso; también deben invalidarse sesiones, permisos pendientes y códigos de recuperación que pudieran volver a habilitarse. Este script no realiza una restauración automática ni elimina datos de producción.

Las pruebas cubren cifrado autenticado, clave equivocada, alteración de descarga, límites, privacidad del bucket y errores sin secretos. En PostgreSQL temporal se verifica el esquema anterior a 019, la lectura consistente frente a una escritura concurrente, los valores históricos y la omisión posterior a la migración. La prueba no utiliza Storage ni datos de producción: sustituye exclusivamente el transporte remoto.

Este respaldo permite conservar el estado anterior a la migración; no evita el breve periodo de incompatibilidad del proceso antiguo mientras Render prepara el nuevo. La publicación requiere verificar el backend actualizado antes del frontend. Un rollback del servicio no restaura automáticamente la base externa, según la [documentación de Render](https://render.com/docs/rollbacks).
