const path = require('node:path');
require('dotenv').config({ path:path.join(__dirname,'../.env'), quiet:true });
function config() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || secret.startsWith('REEMPLAZAR')) throw new Error('Configura JWT_SECRET con al menos 32 caracteres aleatorios.');
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL.');
  const origins = (process.env.CORS_ORIGIN || '').split(',').map(value=>value.trim()).filter(Boolean);
  if (!origins.length || origins.some(value=>value==='*' || !/^https?:\/\/[^/]+$/.test(value))) throw new Error('CORS_ORIGIN debe contener orígenes exactos sin comodines ni rutas.');
  const production = process.env.NODE_ENV === 'production';
  if (production && origins.some(origin=>!origin.startsWith('https://'))) throw new Error('En producción CORS_ORIGIN requiere HTTPS.');
  return { secret, origins, production, port:Number(process.env.PORT || 3000), host:process.env.HOST || '127.0.0.1', expires:process.env.JWT_EXPIRES_IN || '30m' };
}
module.exports = config;
