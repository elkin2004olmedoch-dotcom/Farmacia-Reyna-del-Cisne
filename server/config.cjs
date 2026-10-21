const path = require('node:path');
require('dotenv').config({ path:path.join(__dirname,'../.env'), quiet:true });
function exactOrigin(value) {
  try {
    const url=new URL(value);
    return ['http:','https:'].includes(url.protocol) && url.origin===value && !url.username && !url.password && url.pathname==='/' && !url.search && !url.hash && !value.includes('*');
  } catch { return false; }
}
function config() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || secret.startsWith('REEMPLAZAR')) throw new Error('Configura JWT_SECRET con al menos 32 caracteres aleatorios.');
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL.');
  const renderOrigin=/^https:\/\/[a-z0-9][a-z0-9-]*\.onrender\.com\/?$/.test(process.env.RENDER_EXTERNAL_URL || '')?process.env.RENDER_EXTERNAL_URL.replace(/\/$/,''):'';
  const origins = (process.env.CORS_ORIGIN || renderOrigin).split(',').map(value=>value.trim()).filter(Boolean);
  if (!origins.length || origins.some(value=>!exactOrigin(value))) throw new Error('CORS_ORIGIN debe contener orígenes exactos sin credenciales, rutas, consultas, fragmentos ni comodines.');
  const production = process.env.NODE_ENV === 'production';
  if (production && origins.some(origin=>!origin.startsWith('https://'))) throw new Error('En producción CORS_ORIGIN requiere HTTPS.');
  return { secret, origins, production, port:Number(process.env.PORT || 3000), host:process.env.HOST || '127.0.0.1', expires:process.env.JWT_EXPIRES_IN || '30m' };
}
module.exports = config;
