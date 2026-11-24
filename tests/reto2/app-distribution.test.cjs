const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {buildPages}=require('../../scripts/build-pages.cjs');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-browser-'));
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
test('Pages publica la farmacia para navegador sin instaladores ni descargas nativas',()=>{
  const output=path.join(temporary,'public');
  buildPages({output,apiOrigin:'https://api.example.test'});
  for(const file of ['index.html','admin.html','entregas.html','app-worker.js','assets/app-icons/icon-180.png'])assert.ok(fs.existsSync(path.join(output,file)),file);
  for(const file of ['store.webmanifest','admin.webmanifest','instalar-admin.html','offline.html','assets/install.css','descargas'])assert.equal(fs.existsSync(path.join(output,file)),false,file);
  for(const file of ['index.html','admin.html','entregas.html','cuenta.html']){
    const html=fs.readFileSync(path.join(output,file),'utf8');
    assert.doesNotMatch(html,/rel="manifest"|data-app-open|app-install-dialog|instalar-admin|\.apk|install\.css/);
    assert.match(html,/controllers\/app\.js/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(output,'_headers'),'utf8'),/package-archive|\.apk|webmanifest/);
});
test('la fuente conserva la web y retira el proyecto nativo y su workflow',()=>{
  for(const file of ['mobile','.github/workflows/verify-mobile.yml','src/descargas','frontend/templates/install.cjs'])assert.equal(fs.existsSync(path.resolve(file)),false,file);
  for(const file of ['src/controllers/deliveries.js','src/controllers/route-map.js','src/controllers/mascota.js'])assert.ok(fs.existsSync(path.resolve(file)),file);
});
