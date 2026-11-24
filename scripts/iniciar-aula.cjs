const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const express=require('express');

async function start(){
  const root=path.resolve(__dirname,'..');
  process.chdir(root);
  const env=process.env;
  if(fs.existsSync('.env')||env.DATABASE_URL||env.SUPABASE_URL||env.BREVO_API_KEY||env.PAYPHONE_ENABLED==='true')
    throw Error('El aula requiere una instalación separada y una base temporal nueva.');
  const customerHash=env.CLASS_CUSTOMER_HASH;
  if(![customerHash,env.ADMIN_LOGIN_PASSWORD_HASH].every(hash=>/^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/.test(hash||'')))
    throw Error('Configura los dos hashes de acceso del aula en el servicio privado.');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-aula-'));
  const port=Number(env.PORT||3000);
  Object.assign(env,{
    // SQLite has one writer. Queue concurrent sessions at the pool before opening transactions.
    DATABASE_URL:'file:'+path.join(directory,'aula.db').replaceAll('\\','/')+'?connection_limit=1',
    JWT_SECRET:randomBytes(48).toString('hex'),ADMIN_EMAIL:'administracion@aula.invalid',
    ADMIN_USERNAME:'administrador',ADMIN_PASSWORD:'Inicial9-'+randomBytes(24).toString('hex'),
    CORS_ORIGIN:env.RENDER_EXTERNAL_URL||'http://127.0.0.1:'+port,HOST:env.RENDER_EXTERNAL_URL?'0.0.0.0':'127.0.0.1',
    NODE_ENV:env.RENDER_EXTERNAL_URL?'production':'development',IMAGE_STORAGE:'local',
    CUSTOMER_REGISTRATION_REQUIRE_EMAIL:'false',EMAIL_VERIFICATION_ENABLED:'false',
    PAYMENT_PRACTICE_ENABLED:'true',PAYPHONE_ENABLED:'false',PRACTICE_FULFILLMENT_ENABLED:'true'
  });
  for(const args of [
    ['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],
    ['server/prisma/seed.cjs'],['scripts/provision-admin.cjs'],['scripts/sync-catalog.cjs']
  ])execFileSync(process.execPath,args,{stdio:'inherit'});
  const db=require('../server/models/db.cjs');
  const localZone=await db.zonaEntrega.findUniqueOrThrow({where:{id:'puerto-quito'},select:{version:true,tarifaCentavos:true}});
  if(localZone.tarifaCentavos===null){
    const admin=await db.usuario.findUniqueOrThrow({where:{email:env.ADMIN_EMAIL},select:{id:true,tokenVersion:true}});
    await require('../server/models/entregas.cjs').saveZone('puerto-quito',{tarifaCentavos:0,esperadoVersion:localZone.version},admin);
  }
  await db.proveedor.create({data:{nombre:'Distribuidora del aula',ruc:'0102030400001',email:'proveedor@aula.invalid',telefono:'+593990000000',direccion:'Bodega de práctica del aula'}});
  await db.usuario.create({data:{nombre:'Cliente',username:'cliente',email:'cliente@aula.invalid',telefono:'0990000000',role:'user',passwordHash:customerHash}});
  const app=express();
  app.post('/api/auth/register',(_req,res)=>res.status(403).json({ok:false,error:{code:'CLASS_ACCOUNTS',message:'Entra con la cuenta de cliente asignada.'}}));
  const pharmacy=require('../server/app.cjs')();
  pharmacy.locals.classroom=true;
  app.use(pharmacy);
  const server=require('node:http').createServer(app);
  const {listen,createShutdown}=require('../server/lifecycle.cjs');
  const stop=createShutdown(server,{stop:async()=>{},disconnect:()=>db.$disconnect()});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop().then(()=>process.exit(0)));
  await listen(server,port,env.HOST);
  console.info('Aula lista.');
}

start().catch(error=>{console.error(error.message);process.exit(1);});
