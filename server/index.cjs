const fs=require('node:fs');
const http=require('node:http');
const https=require('node:https');
const config=require('./config.cjs')();
const app=require('./app.cjs')(config);
const tls=process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH;
const server=tls?https.createServer({cert:fs.readFileSync(process.env.TLS_CERT_PATH),key:fs.readFileSync(process.env.TLS_KEY_PATH)},app):http.createServer(app);
server.listen(config.port,config.host,()=>console.info(`Farmacia MVC: ${tls?'https':'http'}://localhost:${config.port}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await require('./models/db.cjs').$disconnect();process.exit(0);}));
