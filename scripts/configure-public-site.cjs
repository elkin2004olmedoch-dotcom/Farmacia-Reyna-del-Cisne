const fs=require('node:fs');
const path=require('node:path');
function configure(appOrigin,root=path.resolve(__dirname,'..')) {
  if(!/^https:\/\/[a-z0-9][a-z0-9-]*\.onrender\.com$/.test(appOrigin || ''))throw new Error('Usa el origen HTTPS exacto de tu aplicación Render, sin rutas ni claves.');
  fs.writeFileSync(path.join(root,'data/deployment.json'),JSON.stringify({appOrigin},null,2)+'\n');
  return appOrigin;
}
if(require.main===module){try{console.info('GitHub Pages abrirá la aplicación: '+configure(process.argv[2]));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={configure};
