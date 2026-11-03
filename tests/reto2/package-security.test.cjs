const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-package-security-'));
after(()=>{const resolved=fs.realpathSync(directory);assert(path.dirname(resolved)===fs.realpathSync(os.tmpdir())&&path.basename(resolved).startsWith('farmacia-package-security-'));fs.rmSync(resolved,{recursive:true,force:true});});
test('ZIP conserva fuente y .env.example, excluye variantes de secretos y auditorías privadas sin borrarlas',{skip:process.platform!=='win32'},()=>{
 const write=(file,text='fuente sintética')=>{const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
 for(const name of ['frontend','server','mobile','.github','assets','js','data','scripts','tests','docs'])write(name+'/public.txt');
 for(const file of ['index.html','catalogo.html','producto.html','comparar.html','cuenta.html','checkout.html','pedidos.html','ayuda.html','service-worker.js','robots.txt','render.yaml','package.json','package-lock.json','.env.example','.gitignore','README.md'])write(file);
 const privateFiles=['server/.env.production','frontend/.env.local','docs/.env.test','server/private.env','docs/auditorias/privado.txt','docs/agentes/privado.txt','docs/superpowers/plan.md','server/backups/data.db','server/certificates/private.pem','mobile/android/local.properties','mobile/signing.keystore','mobile/android/build/output.apk'];for(const file of privateFiles)write(file,'PRIVATE_PACKAGE_FIXTURE');
 write('outside/leak.txt','PRIVATE_PACKAGE_FIXTURE');fs.symlinkSync(path.join(directory,'outside'),path.join(directory,'frontend/linked'),'junction');
 fs.copyFileSync('scripts/crear-reto2.ps1',path.join(directory,'scripts/crear-reto2.ps1'));
 const env={};for(const key of ['SystemRoot','SYSTEMROOT','PATH','Path','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
 execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(directory,'scripts/crear-reto2.ps1'),'-Nombre','Reto2_Prueba_Segura.zip'],{env,windowsHide:true,stdio:'pipe',timeout:30000});
 const archive=path.join(directory,'entrega/Reto2_Prueba_Segura.zip');
 const listing=execFileSync('powershell.exe',['-NoProfile','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:PHARMACY_PACKAGE_ARCHIVE); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }'],{env:{...env,PHARMACY_PACKAGE_ARCHIVE:archive},windowsHide:true,encoding:'utf8'}).trim().split(/\r?\n/);
 assert(listing.includes('.env.example'));assert(listing.includes('frontend/public.txt'));assert(listing.includes('server/public.txt'));assert(listing.includes('mobile/public.txt'));assert(listing.includes('docs/public.txt'));
 for(const file of privateFiles){assert(!listing.includes(file),'No debe incluir '+file);assert(fs.statSync(path.join(directory,file)).isFile(),'Debe conservar '+file);}
 assert(!listing.some(name=>name.startsWith('frontend/linked/')),'No publica archivos de una junction');
 const output=path.join(directory,'entrega'),outside=path.join(directory,'outside-output');fs.renameSync(output,output+'-saved');fs.mkdirSync(outside);fs.symlinkSync(outside,output,'junction');
 assert.throws(()=>execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(directory,'scripts/crear-reto2.ps1'),'-Nombre','Reto2_Prueba_Segura.zip'],{env,windowsHide:true,stdio:'pipe',timeout:30000}),/carpeta de entrega no puede ser un enlace/);
 assert.deepEqual(fs.readdirSync(outside),[],'No escribe fuera de la salida autorizada');
});
