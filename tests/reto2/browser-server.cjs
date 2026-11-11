const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-browser-'));
process.env.DATABASE_URL='file:'+path.join(directory,'browser.db').replaceAll('\\','/');
process.env.NODE_ENV='test';process.env.CORS_ORIGIN='http://localhost:3300';process.env.PORT='3300';
// Keep the local journey isolated even when the shell has commercial settings.
process.env.EMAIL_VERIFICATION_ENABLED='false';process.env.CUSTOMER_REGISTRATION_REQUIRE_EMAIL='false';process.env.PAYPHONE_ENABLED='false';
process.env.UPLOAD_DIR=path.join(directory,'uploads');
process.env.JWT_SECRET=randomBytes(48).toString('hex');process.env.ADMIN_EMAIL='admin-browser@example.ec';process.env.ADMIN_PASSWORD='AdminBrowser2026!';
const steps=[['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],['server/prisma/seed.cjs']];
if(process.env.PHARMACY_BROWSER_EXPANDED_CATALOG==='true')steps.push(['scripts/sync-catalog.cjs']);
for(const args of steps)execFileSync(process.execPath,args,{env:process.env,stdio:'pipe'});
const settings={...require('../../server/config.cjs')(),testAuthLimit:200,testApiLimit:2000};
require('./geocoder-fixture.cjs')();
const createApp=require('../../server/app.cjs'),db=require('../../server/models/db.cjs'),{Prisma}=require('../../server/models/prisma-client.cjs');
const models=Prisma.dmmf.datamodel.models,remaining=[...models],ordered=[];
while(remaining.length){const next=remaining.find(model=>!remaining.some(child=>child.fields.some(field=>field.kind==='object'&&field.type===model.name&&field.relationFromFields?.length)));if(!next)throw new Error('Revisa las relaciones del fixture temporal.');ordered.push(next.name[0].toLowerCase()+next.name.slice(1));remaining.splice(remaining.indexOf(next),1);}
let runtime=createApp(settings),baseline;
const app=require('express')();
// Sólo este servidor de pruebas, en loopback y con una BD temporal, registra el reinicio.
app.post('/_test/reset',async(req,res)=>{
  if(!process.env.PHARMACY_BROWSER_RESET_KEY||req.get('X-Test-Reset')!==process.env.PHARMACY_BROWSER_RESET_KEY)return res.sendStatus(403);
  if(!baseline)baseline=await db.$transaction(async tx=>Object.fromEntries(await Promise.all(ordered.map(async name=>[name,await tx[name].findMany()]))));
  await db.$transaction(async tx=>{for(const name of ordered)await tx[name].deleteMany();for(const name of [...ordered].reverse())if(baseline[name].length)await tx[name].createMany({data:baseline[name]});});
  runtime=createApp(settings);res.sendStatus(204);
});
app.use((req,res,next)=>runtime(req,res,next));
const server=app.listen(3300,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{
  await require('../../server/models/db.cjs').$disconnect();
  if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-browser-'))fs.rmSync(directory,{recursive:true,force:true});
  process.exit(0);
}));
