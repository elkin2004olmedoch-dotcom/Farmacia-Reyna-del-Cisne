const fs=require('node:fs');
const http=require('node:http');
const https=require('node:https');
const config=require('./config.cjs')();
const app=require('./app.cjs')(config);
const tls=process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH;
const server=tls?https.createServer({cert:fs.readFileSync(process.env.TLS_CERT_PATH),key:fs.readFileSync(process.env.TLS_KEY_PATH)},app):http.createServer(app);
let backups;
async function start(){
  if (/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '')) {
    // The SQLite file backup cannot protect a remote PostgreSQL database.
    console.info('PostgreSQL remoto: configura respaldos externos de la base y del almacenamiento de imágenes.');
  } else backups=await require('./models/backups.cjs').startAutomaticBackups();
  server.listen(config.port,config.host,()=>console.info(`Farmacia MVC: ${tls?'https':'http'}://localhost:${config.port}`));
}
start().catch(async error=>{console.error('No se pudo iniciar el servidor.');await backups?.stop();await require('./models/db.cjs').$disconnect();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await backups?.stop();await require('./models/db.cjs').$disconnect();process.exit(0);}));
