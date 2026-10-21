const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-build-'));
after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-pages-'));fs.rmSync(directory,{recursive:true,force:true});});
const {buildPages}=require('../../scripts/build-pages.cjs');
test('artefacto solo publica estáticos cliente y configuración pública con CSP exacta',async()=>{
  const output=path.join(directory,'public');
  const result=buildPages({output,apiOrigin:'https://api.example.test',imageOrigin:'https://images.example.test'});
  assert.ok(result.files>80);
  for(const file of ['index.html','admin.html','checkout.html','404.html','models/api.js','assets/images/farmacia-fachada-reina.webp'])assert.ok(fs.existsSync(path.join(output,file)),file);
  for(const file of ['.env','.env.example','server','data','docs','node_modules','assets/uploads','functions','_worker.js'])assert.ok(!fs.existsSync(path.join(output,file)),file);
  const config=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(output,'config.js'))).toString('base64'));
  assert.equal(config.apiUrl('/productos?pageSize=4'),'https://api.example.test/api/productos?pageSize=4');
  assert.equal(config.publicImageUrl('assets/uploads/00000000-0000-4000-8000-000000000000.webp'),'https://api.example.test/assets/uploads/00000000-0000-4000-8000-000000000000.webp');
  assert.equal(config.publicImageUrl('https://evil.example/secret'),'assets/images/logo-reina-del-cisne.png');
  assert.throws(()=>config.apiUrl('//evil.example'));
  const headers=fs.readFileSync(path.join(output,'_headers'),'utf8');
  assert.match(headers,/connect-src 'self' https:\/\/api\.example\.test;/);
  assert.match(headers,/img-src 'self' data: https:\/\/api\.example\.test https:\/\/images\.example\.test;/);
  assert.match(headers,/frame-ancestors 'none'/);assert.match(headers,/max-age=0, must-revalidate/);
  assert.ok(!headers.includes('unsafe-inline') && !headers.includes('unsafe-eval'));
  assert.equal(fs.readFileSync(path.join(output,'index.html'),'utf8'),fs.readFileSync('frontend/index.html','utf8'));
  assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/id="featured-products"[^>]*aria-live="polite"[^>]*>Cargando productos/);
});
test('build rechaza orígenes inseguros sin incluir credenciales en errores',()=>{
  const output=path.join(directory,'invalid');
  for(const apiOrigin of ['https://user:private-password@api.example.test','https://api.example.test/path','https://*.example.test','http://api.example.test','https://api.example.test?x=1'])assert.throws(()=>buildPages({output,apiOrigin}),error=>!error.message.includes('private-password'));
});
test('desarrollo requiere loopback explícito y no puede borrar un directorio ajeno',()=>{
  const output=path.join(directory,'local');
  assert.throws(()=>buildPages({output,apiOrigin:'http://127.0.0.1:3302'}));
  buildPages({output,apiOrigin:'http://127.0.0.1:3302',allowLocal:true});
  assert.throws(()=>buildPages({output:path.resolve('frontend'),apiOrigin:'https://api.example.test'}));
  assert.ok(fs.existsSync('frontend/index.html'));
});
test('una junction en un antecesor no permite reemplazar archivos fuera de la salida',()=>{
  const outside=path.join(directory,'outside'),link=path.join(directory,'junction');
  fs.mkdirSync(path.join(outside,'public'),{recursive:true});
  const sentinel=path.join(outside,'public','keep.txt');fs.writeFileSync(sentinel,'preserve synthetic data');
  fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>buildPages({output:path.join(link,'public'),apiOrigin:'https://api.example.test'}));
  assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve synthetic data');
});

test('artefacto conserva los módulos del asistente administrativo y la ayuda contextual',()=>{
  const output=path.join(directory,'modules');
  buildPages({output,apiOrigin:'https://api.example.test'});
  for(const file of ['controllers/admin-companion.js','controllers/admin-command.mjs','controllers/mascota-scope.mjs','assets/mascotas/admin-companion.css','assets/mascotas/widget-responsive.css'])assert.ok(fs.existsSync(path.join(output,file)),file);
  for(const directory of ['controllers','models','views'])for(const file of fs.readdirSync(path.join(output,directory))){
    if(!/\.m?js$/.test(file))continue;
    const filename=path.join(output,directory,file),source=fs.readFileSync(filename,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(path.dirname(filename),match[1])),directory+'/'+file+': '+match[1]);
  }
});
