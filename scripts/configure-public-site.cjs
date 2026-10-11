const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
function configure(appOrigin,root=path.resolve(__dirname,'..')) {
  if(!/^https:\/\/[a-z0-9][a-z0-9-]*\.onrender\.com$/.test(appOrigin || ''))throw new Error('Usa el origen HTTPS exacto de tu aplicación Render, sin rutas ni claves.');
  const workerPath=path.join(root,'service-worker.js');
  const worker=fs.readFileSync(workerPath,'utf8');
  if(!/const CACHE_NAME = '[^']+';/.test(worker))throw new Error('No se encontró la versión de caché.');
  const version='farmacia-reina-shell-cloud-'+createHash('sha256').update(appOrigin).digest('hex').slice(0,12);
  fs.writeFileSync(path.join(root,'data/deployment.json'),JSON.stringify({appOrigin},null,2)+'\n');
  fs.writeFileSync(workerPath,worker.replace(/const CACHE_NAME = '[^']+';/,`const CACHE_NAME = '${version}';`));
  return appOrigin;
}
if(require.main===module){try{console.info('GitHub Pages abrirá la aplicación: '+configure(process.argv[2]));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={configure};
