const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
test('MVC separa datos, renderizado, eventos, rutas, controladores y middleware',()=>{
  for(const folder of ['src/models','src/views','src/controllers','src/assets','backend/routes','backend/controllers','backend/models','backend/middleware','backend/prisma/migrations'])assert.ok(fs.statSync(path.join(root,folder)).isDirectory());
  for(const file of fs.readdirSync(path.join(root,'src/views')).filter(file=>file.endsWith('.js'))){const code=fs.readFileSync(path.join(root,'src/views',file),'utf8');assert.ok(!/\bfetch\(/.test(code),'La vista no consume la API.');assert.ok(!/addEventListener\(/.test(code),'Los eventos se controlan fuera de la vista.');}
  for(const file of fs.readdirSync(path.join(root,'backend/controllers'))){const code=fs.readFileSync(path.join(root,'backend/controllers',file),'utf8');assert.ok(!/\.(findMany|findUnique|\$transaction)\(/.test(code),'Los controladores no consultan Prisma directamente.');}
});
test('las pantallas web apuntan a recursos locales existentes',()=>{
  const pages=fs.readdirSync(path.join(root,'src')).filter(file=>file.endsWith('.html'));assert.deepEqual(pages.sort(),['index.html','catalogo.html','producto.html','comparar.html','cuenta.html','confirmar-correo.html','recuperar-cuenta.html','checkout.html','pedidos.html','admin.html','ayuda.html','entregas.html','seguimiento.html','pagos.html'].sort());
  for(const file of pages){const html=fs.readFileSync(path.join(root,'src',file),'utf8');assert.match(html,/<html lang="es">/);assert.match(html,/<main(?:\s|>)/);for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const url=match[1];if(/^(https?:|tel:|mailto:)/.test(url))continue;const local=url.split(/[?#]/)[0];assert.ok(fs.existsSync(path.join(root,'src',local)),`${file}: ${local}`);}}
  for(const folder of ['models','views','controllers'])for(const file of fs.readdirSync(path.join(root,'src',folder)).filter(file=>file.endsWith('.js'))){const code=fs.readFileSync(path.join(root,'src',folder,file),'utf8');for(const match of code.matchAll(/(?:from\s+|import\s+)['"]([^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(root,'src',folder,match[1])));}
});
test('configuración de producción rechaza secreto débil y orígenes inseguros',()=>{
  const config=require('../../backend/config.cjs');const before={...process.env};
  try{process.env.DATABASE_URL='file:./test.db';process.env.JWT_SECRET='corta';process.env.CORS_ORIGIN='http://localhost:3000';assert.throws(config);process.env.JWT_SECRET='a'.repeat(64);process.env.CORS_ORIGIN='*';assert.throws(config);process.env.CORS_ORIGIN='http://localhost:3000';process.env.NODE_ENV='production';assert.throws(config);process.env.CORS_ORIGIN='https://farmacia.example.ec';assert.equal(config().production,true);}finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});
test('el ejemplo permite registro local sin proveedor y producción exige verificar por defecto',()=>{
  const config=require('../../backend/config.cjs'),before={...process.env};
  try{
    Object.assign(process.env,require('dotenv').parse(fs.readFileSync(path.join(root,'.env.example'))),{NODE_ENV:'development',JWT_SECRET:'x'.repeat(64)});
    assert.equal(config().requireVerifiedRegistration,false);
    process.env.NODE_ENV='production';process.env.CORS_ORIGIN='https://farmacia.example.ec';
    assert.equal(config().requireVerifiedRegistration,true);
  }finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});
