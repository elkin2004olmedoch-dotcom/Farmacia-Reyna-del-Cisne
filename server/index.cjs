const diagnostics=require('./diagnostics.cjs');
diagnostics.phase('process_start');
const fs=require('node:fs');
const http=require('node:http');
const https=require('node:https');
const {listen,createShutdown}=require('./lifecycle.cjs');
const config=require('./config.cjs')();
diagnostics.phase('config_ready');
const app=require('./app.cjs')(config);
diagnostics.phase('app_ready');
const tls=process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH;
const server=tls?https.createServer({cert:fs.readFileSync(process.env.TLS_CERT_PATH),key:fs.readFileSync(process.env.TLS_KEY_PATH)},app):http.createServer(app);
let backupsStarted,locationTimer,locationStartupTimer;
let stopping=false;
const shutdown=createShutdown(server,{stop:async()=>{const backups=await backupsStarted;await backups?.stop();},disconnect:()=>require('./models/db.cjs').$disconnect()});
function stop(){stopping=true;clearTimeout(locationStartupTimer);clearInterval(locationTimer);return shutdown();}
async function start(){
  if (/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '')) {
    // The SQLite file backup cannot protect a remote PostgreSQL database.
    console.info('PostgreSQL remoto: configura respaldos externos de la base y del almacenamiento de imágenes.');
  } else{diagnostics.phase('backups_start');backupsStarted=require('./models/backups.cjs').startAutomaticBackups();await backupsStarted;diagnostics.phase('backups_ready');}
  if(stopping)return;
  await listen(server,config.port,config.host);
  if(stopping)return;
  diagnostics.phase('listening');console.info(`Farmacia MVC: ${tls?'https':'http'}://localhost:${config.port}`);
  // Cleanup must not delay HTTP startup. Read endpoints independently hide stale locations.
  const purge=()=>require('./models/entregas.cjs').purgeExpiredLocations().catch(()=>console.error('No se pudo completar la limpieza temporal de ubicaciones.'));
  locationStartupTimer=setTimeout(purge,1000);locationStartupTimer.unref();locationTimer=setInterval(purge,60000);locationTimer.unref();
}
start().catch(async()=>{diagnostics.phase('startup_failed');console.error('No se pudo iniciar el servidor.');try{await stop();}catch{console.error('No se pudo completar el cierre del servidor.');}process.exit(1);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{diagnostics.emit('shutdown',{signal});stop().then(()=>process.exit(0),()=>{console.error('No se pudo completar el cierre del servidor.');process.exit(1);});});
