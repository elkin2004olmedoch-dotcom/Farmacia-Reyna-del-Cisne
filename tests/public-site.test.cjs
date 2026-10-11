const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {destination}=require('../js/live-site.js');
const {configure}=require('../scripts/configure-public-site.cjs');
const origin='https://farmacia-prueba.onrender.com';
const base='https://usuario.github.io/Farmacia-Reyna-del-Cisne/';
test('Pages abre la misma ficha o cuenta en la aplicación pública conservando consulta y sección',()=>{
  assert.equal(destination({appOrigin:origin},base+'producto.html?id=alcohol-antiseptico#contenido',base),origin+'/producto.html?id=alcohol-antiseptico#contenido');
  assert.equal(destination({appOrigin:origin},base+'cuenta.html',base),origin+'/cuenta.html');
  assert.equal(destination({appOrigin:origin},base,base),origin+'/index.html');
});
test('sin despliegue confirmado sigue disponible Pages y rechaza destinos o páginas inesperados',()=>{
  for(const target of [null,'http://farmacia-prueba.onrender.com','https://otro.example.com','https://farmacia-prueba.onrender.com.evil.test','https://usuario:clave@farmacia-prueba.onrender.com','https://farmacia-prueba.onrender.com/?clave=valor'])assert.equal(destination({appOrigin:target},base+'cuenta.html',base),null);
  assert.equal(destination({appOrigin:origin},origin+'/cuenta.html',origin+'/'),null);
  assert.equal(destination({appOrigin:origin},base+'../otro/cuenta.html',base),null);
  assert.equal(destination({appOrigin:origin},base+'archivo.html',base),null);
});
test('activar la URL pública actualiza solo configuración y versión de caché sin publicar secretos',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-public-site-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'service-worker.js'),"const CACHE_NAME = 'farmacia-reina-shell-v5-cloud-ready';\n");
  assert.throws(()=>configure(origin+'/ruta',root),/origen HTTPS exacto/);
  configure(origin,root);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'data/deployment.json'),'utf8')),{appOrigin:origin});
  assert.match(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),/farmacia-reina-shell-cloud-[a-f0-9]{12}/);
});
