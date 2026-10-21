const diagnostics=require('./diagnostics.cjs');
diagnostics.phase('process_start');
const fs=require('node:fs');
const http=require('node:http');
const https=require('node:https');
const config=require('./config.cjs')();
diagnostics.phase('config_ready');
const app=require('./app.cjs')(config);
diagnostics.phase('app_ready');
const tls=process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH;
const server=tls?https.createServer({cert:fs.readFileSync(process.env.TLS_CERT_PATH),key:fs.readFileSync(process.env.TLS_KEY_PATH)},app):http.createServer(app);
let backups;
async function start(){
  if (/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '')) {
    // The SQLite file backup cannot protect a remote PostgreSQL database.
    console.info('PostgreSQL remoto: configura respaldos externos de la base y del almacenamiento de imágenes.');
  } else{diagnostics.phase('backups_start');backups=await require('./models/backups.cjs').startAutomaticBackups();diagnostics.phase('backups_ready');}
  server.listen(config.port,config.host,()=>{diagnostics.phase('listening');console.info(`Farmacia MVC: ${tls?'https':'http'}://localhost:${config.port}`);});
}
start().catch(async error=>{diagnostics.phase('startup_failed');console.error('No se pudo iniciar el servidor.');await backups?.stop();await require('./models/db.cjs').$disconnect();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{diagnostics.emit('shutdown',{signal});server.close(async()=>{await backups?.stop();await require('./models/db.cjs').$disconnect();process.exit(0);});});
