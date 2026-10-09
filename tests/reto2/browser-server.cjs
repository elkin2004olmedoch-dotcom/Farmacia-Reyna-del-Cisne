const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-browser-'));
process.env.DATABASE_URL='file:'+path.join(directory,'browser.db').replaceAll('\\','/');
process.env.NODE_ENV='test';process.env.CORS_ORIGIN='http://localhost:3300';process.env.PORT='3300';
process.env.UPLOAD_DIR=path.join(directory,'uploads');
process.env.JWT_SECRET=randomBytes(48).toString('hex');process.env.ADMIN_EMAIL='admin-browser@example.ec';process.env.ADMIN_PASSWORD='AdminBrowser2026!';
for(const args of [['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],['server/prisma/seed.cjs']])execFileSync(process.execPath,args,{env:process.env,stdio:'pipe'});
const server=require('../../server/app.cjs')().listen(3300,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{
  await require('../../server/models/db.cjs').$disconnect();
  if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-browser-'))fs.rmSync(directory,{recursive:true,force:true});
  process.exit(0);
}));
