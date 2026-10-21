const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const defaultOutput=path.join(root,'dist/pages');
function noLinks(target,anchor){
  const relative=path.relative(anchor,target),realAnchor=fs.realpathSync(anchor);
  if(relative.startsWith('..') || path.isAbsolute(relative))throw new Error('Ruta fuera del directorio autorizado.');
  let current=anchor;
  for(const part of ['',...relative.split(path.sep).filter(Boolean)]){
    current=path.join(current,part);let stat;
    try{stat=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(stat.isSymbolicLink())throw new Error('No se permiten enlaces en las rutas de entrada o salida.');
    const actual=path.relative(realAnchor,fs.realpathSync(current));
    if(actual.startsWith('..') || path.isAbsolute(actual))throw new Error('Ruta resuelta fuera del directorio autorizado.');
  }
}
function publicOrigin(value,allowLocal){
  try{
    const url=new URL(value);
    const local=allowLocal && url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if((url.protocol!=='https:' && !local) || url.origin!==value || url.username || url.password || value.includes('*'))throw new Error();
    return url.origin;
  }catch(_){throw new Error('Configura un origen público exacto HTTPS, sin credenciales, ruta ni comodines.');}
}
function buildPages({output=defaultOutput,apiOrigin=process.env.PUBLIC_API_ORIGIN || require('../data/deployment.json').appOrigin,imageOrigin=process.env.PUBLIC_IMAGE_ORIGIN || '',allowLocal=false}={}){
  apiOrigin=publicOrigin(apiOrigin,allowLocal);
  if(imageOrigin)imageOrigin=publicOrigin(imageOrigin,allowLocal);
  output=path.resolve(output);
  const tempRelative=path.relative(os.tmpdir(),output);
  const temporary=!tempRelative.startsWith('..') && !path.isAbsolute(tempRelative) && /^farmacia-pages-[^/\\]+[/\\]/.test(tempRelative);
  if(output!==defaultOutput && !temporary)throw new Error('La salida debe ser dist/pages o una carpeta temporal farmacia-pages-*/public.');
  noLinks(output,output===defaultOutput?root:os.tmpdir());
  // Only these generated output locations may be replaced. Never operate on the source tree.
  if(fs.existsSync(output)){if(fs.lstatSync(output).isSymbolicLink())throw new Error('La salida no puede ser un enlace.');fs.rmSync(output,{recursive:true,force:true});}
  fs.mkdirSync(output,{recursive:true});
  const frontend=path.join(root,'frontend');noLinks(frontend,root);
  const read=relative=>{const file=path.join(frontend,relative);noLinks(file,frontend);return fs.readFileSync(file);};
  let files=0,bytes=0,maxFileBytes=0;
  const write=(relative,content)=>{
    const size=Buffer.byteLength(content);
    if(size>25*1024*1024 || ++files>20000)throw new Error('El artefacto supera los límites estáticos de Pages Free.');
    const target=path.join(output,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);bytes+=size;maxFileBytes=Math.max(maxFileBytes,size);
  };
  const pages=['index.html','catalogo.html','producto.html','comparar.html','cuenta.html','checkout.html','pedidos.html','admin.html','ayuda.html'];
  for(const file of pages)write(file,read(file));
  function copy(directory){
    for(const entry of fs.readdirSync(path.join(root,'frontend',directory),{withFileTypes:true})){
      if(entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name==='uploads')continue;
      const relative=directory+'/'+entry.name;
      if(entry.isDirectory()){copy(relative);continue;}
      const allowed=directory.startsWith('assets')
        ? /\.(?:css|js|png|jpg|jpeg|webp|svg|ttf|woff2?)$/.test(entry.name) || relative==='assets/mascotas/sprites/manifest.json'
        : /\.m?js$/.test(entry.name);
      if(allowed)write(relative,read(relative));
    }
  }
  for(const directory of ['controllers','models','views','assets'])copy(directory);
  const source=read('config.js').toString('utf8');
  if(!source.includes("export const apiOrigin='';"))throw new Error('La plantilla de configuración pública no es válida.');
  write('config.js',source.replace("export const apiOrigin='';",`export const apiOrigin=${JSON.stringify(apiOrigin)};`));
  const images=["'self'",'data:',apiOrigin,...(imageOrigin?[imageOrigin]:[])].join(' ');
  const csp=`default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src ${images}; connect-src 'self' ${apiOrigin}; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  write('_headers',`/*\n  Content-Security-Policy: ${csp}\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Cross-Origin-Opener-Policy: same-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
  write('404.html','<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no encontrada | Farmacia Reina del Cisne</title><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/shop.css"></head><body><main class="section-wrap shop-main"><h1>No encontramos esta página.</h1><p>Revisa la dirección o vuelve al inicio de la farmacia.</p><a class="button button-primary" href="/">Volver al inicio</a></main></body></html>\n');
  return {output,files,bytes,maxFileBytes,apiOrigin,imageOrigin};
}
if(require.main===module){try{console.info(JSON.stringify(buildPages(),null,2));}catch(_){console.error('No se pudo preparar Pages. Revisa los orígenes públicos y la carpeta de salida.');process.exitCode=1;}}
module.exports={buildPages};
