const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const schema = 'server/prisma/postgresql/schema.prisma';

function httpsOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} requiere un origen HTTPS válido.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== value) {
    throw new Error(`${label} requiere un origen HTTPS exacto, sin credenciales, rutas ni parámetros.`);
  }
  return url;
}

// No .env loading or process.env changes: cloud secrets come from the host.
function productionEnvironment(input) {
  const env = {...input};
  if (env.NODE_ENV !== 'production') throw new Error('setup:production requiere NODE_ENV=production.');
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL debe ser una conexión PostgreSQL privada.'); }
  if (!['postgresql:', 'postgres:'].includes(database.protocol) || !database.hostname || !database.username || !database.password || database.pathname === '/' || !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode'))) {
    throw new Error('DATABASE_URL requiere PostgreSQL con credenciales, nombre de base y sslmode=require (o verify-full).');
  }
  if (!env.CORS_ORIGIN && env.RENDER_EXTERNAL_URL) {
    const rendered = httpsOrigin(env.RENDER_EXTERNAL_URL, 'RENDER_EXTERNAL_URL');
    if (!/^[a-z0-9-]+\.onrender\.com$/i.test(rendered.hostname)) throw new Error('RENDER_EXTERNAL_URL debe ser el origen HTTPS asignado por Render.');
    env.CORS_ORIGIN = rendered.origin;
  }
  const origins = (env.CORS_ORIGIN || '').split(',').map(value => value.trim());
  if (!origins.length || origins.some(value => !value)) throw new Error('Configura CORS_ORIGIN con el origen HTTPS de la farmacia.');
  for (const origin of origins) httpsOrigin(origin, 'CORS_ORIGIN');
  env.CORS_ORIGIN = origins.join(',');
  if (env.HOST && env.HOST !== '0.0.0.0') throw new Error('El despliegue requiere HOST=0.0.0.0.');
  env.HOST = '0.0.0.0';
  const secret = env.JWT_SECRET || '';
  if (secret.length < 32 || secret.startsWith('REEMPLAZAR')) throw new Error('Configura JWT_SECRET con al menos 32 caracteres aleatorios.');
  const password = env.ADMIN_PASSWORD || '';
  if (password.startsWith('REEMPLAZAR') || password.length < 10 || Buffer.byteLength(password) > 72 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new Error('Configura ADMIN_PASSWORD con al menos 10 caracteres, letra y número, y como máximo 72 bytes.');
  }
  const email = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!require('../frontend/models/ecuador.js').validEmail(email)) throw new Error('Configura ADMIN_EMAIL con un correo válido.');
  env.ADMIN_EMAIL = email;
  if (env.IMAGE_STORAGE !== 'supabase') throw new Error('La instancia gratuita requiere IMAGE_STORAGE=supabase para conservar las imágenes.');
  const storage = httpsOrigin(env.SUPABASE_URL || '', 'SUPABASE_URL');
  if (storage.port || !/^[a-z0-9-]+\.supabase\.co$/i.test(storage.hostname)) throw new Error('SUPABASE_URL debe ser el origen HTTPS del proyecto Supabase.');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.length < 20 || env.SUPABASE_SERVICE_ROLE_KEY.startsWith('REEMPLAZAR')) {
    throw new Error('Configura SUPABASE_SERVICE_ROLE_KEY como secreto privado del servidor.');
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(env.SUPABASE_STORAGE_BUCKET || '')) throw new Error('Configura SUPABASE_STORAGE_BUCKET con un nombre válido.');
  if (env.SKIP_INITIAL_SEED && !['true', 'false'].includes(env.SKIP_INITIAL_SEED)) throw new Error('SKIP_INITIAL_SEED debe ser true o false.');
  return env;
}

function runSetup({env = process.env, run = spawnSync, logger = console} = {}) {
  const productionEnv = productionEnvironment(env);
  const steps = [
    ['Generar cliente PostgreSQL', ['node_modules/prisma/build/index.js', 'generate', '--schema', schema]],
    ['Aplicar migraciones PostgreSQL', ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', schema]]
  ];
  if (productionEnv.SKIP_INITIAL_SEED !== 'true') steps.push(['Preparar catálogo y administrador', ['server/prisma/seed.cjs']]);
  steps.push(['Generar frontend', ['scripts/build-frontend.cjs']]);
  for (const [label, args] of steps) {
    logger.info(label + '…');
    // Prisma may print database connection details. Keep child output private.
    let result;
    try { result = run(process.execPath, args, {cwd: root, env: productionEnv, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024}); }
    catch { throw new Error(`Falló el paso: ${label}. Revisa la configuración privada y la conexión del servicio.`); }
    if (!result || result.error || result.status !== 0) throw new Error(`Falló el paso: ${label}. Revisa la configuración privada y la conexión del servicio.`);
  }
  logger.info('Preparación de producción completada. Ejecuta npm start.');
}

if (require.main === module) {
  try { runSetup(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {productionEnvironment, runSetup};
