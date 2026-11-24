const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {destination}=require('../js/live-site.js');
const {configure}=require('../scripts/configure-public-site.cjs');
const origin='https://farmacia-prueba.onrender.com';
const base='https://usuario.github.io/Farmacia-Reyna-del-Cisne/';
test('el helper de enlaces conserva ficha, consulta y sección al redirigir a Render',()=>{
  assert.equal(destination({appOrigin:origin},base+'producto.html?id=alcohol-antiseptico#contenido',base),origin+'/producto.html?id=alcohol-antiseptico#contenido');
  assert.equal(destination({appOrigin:origin},base+'cuenta.html',base),origin+'/cuenta.html');
  assert.equal(destination({appOrigin:origin},base,base),origin+'/index.html');
});
test('la tienda de GitHub Pages se mantiene disponible mientras Render despliega',()=>{
  for(const target of [null,'http://farmacia-prueba.onrender.com','https://otro.example.com','https://farmacia-prueba.onrender.com.evil.test','https://usuario:clave@farmacia-prueba.onrender.com','https://farmacia-prueba.onrender.com/?clave=valor'])assert.equal(destination({appOrigin:target},base+'cuenta.html',base),null);
  assert.equal(destination({appOrigin:origin},origin+'/cuenta.html',origin+'/'),null);
  assert.equal(destination({appOrigin:origin},base+'../otro/cuenta.html',base),null);
  assert.equal(destination({appOrigin:origin},base+'archivo.html',base),null);
});
test('las páginas públicas cargan las mascotas y sus sprites sin depender de Render',()=>{
  for(const page of ['index.html','catalogo.html','producto.html','comparar.html','checkout.html','cuenta.html','pedidos.html','ayuda.html']){
    const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    assert.match(html,/js\/mascota\.js/,`${page} incluye el widget`);
    assert.doesNotMatch(html,/js\/live-site\.js/,`${page} no redirige a Render`);
  }
  for(const file of ['src/controllers/mascota.js','src/assets/mascotas/widget.css','src/assets/mascotas/widget-responsive.css','src/assets/mascotas/sprites/manifest.json','src/assets/mascotas/sprites/goti.png','src/assets/mascotas/sprites/farmi.png','src/assets/mascotas/sprites/boti.png'])
    assert.ok(fs.existsSync(path.join(__dirname,'..',file)),`${file} se publica con Pages`);
});
test('activar la URL pública actualiza la configuración sin reactivar una caché retirada',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-public-site-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'service-worker.js'),"const CACHE_NAME = 'farmacia-reina-shell-v5-cloud-ready';\n");
  assert.throws(()=>configure(origin+'/ruta',root),/origen HTTPS exacto/);
  configure(origin,root);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'data/deployment.json'),'utf8')),{appOrigin:origin});
  assert.equal(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),"const CACHE_NAME = 'farmacia-reina-shell-v5-cloud-ready';\n");
});
