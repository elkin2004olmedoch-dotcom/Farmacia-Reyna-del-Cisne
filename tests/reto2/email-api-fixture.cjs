'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function postgresTestUrl(value){
  let url;try{url=new URL(value);}catch{throw new Error('La URL PostgreSQL de pruebas no es válida.');}
  const keys=[...url.searchParams.keys()];
  if(!['postgres:','postgresql:'].includes(url.protocol) || !['127.0.0.1','localhost'].includes(url.hostname) || url.port!=='55421' || url.pathname!=='/farmacia_email_test' || url.hash || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(url.username) || new Set(keys).size!==keys.length || keys.some(key=>!['schema','connection_limit'].includes(key)) || url.searchParams.has('schema') && url.searchParams.get('schema')!=='public' || url.searchParams.has('connection_limit') && !/^[1-4]$/.test(url.searchParams.get('connection_limit')))throw new Error('Sólo se permite PostgreSQL loopback:55421/farmacia_email_test con parámetros de pruebas.');
  return url.href;
}
function createFixture(){
  // Never obtain a database or provider configuration from .env or DATABASE_URL.
  const postgres=process.env.PHARMACY_EMAIL_TEST_DATABASE_URL?postgresTestUrl(process.env.PHARMACY_EMAIL_TEST_DATABASE_URL):null;
  const tempRoot=fs.realpathSync(os.tmpdir()),directory=fs.mkdtempSync(path.join(tempRoot,'farmacia-email-'));
  function checkedDirectory(){
    const resolved=fs.realpathSync(directory);
    if(path.dirname(resolved)!==tempRoot || !/^farmacia-email-[a-zA-Z0-9_-]+$/.test(path.basename(resolved)))throw new Error('La carpeta temporal de correo salió del destino autorizado.');
    return resolved;
  }
  function removeDirectory(){if(fs.existsSync(directory))fs.rmSync(checkedDirectory(),{recursive:true,force:true});}
  const database=postgres || 'file:'+path.join(checkedDirectory(),'email.db').replaceAll('\\','/');
  const isolated={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:tempRoot,TMP:tempRoot,NODE_ENV:'test',DATABASE_URL:database,JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3300',ADMIN_EMAIL:'email-admin@example.ec',ADMIN_PASSWORD:'SyntheticEmailAdmin2026!',UPLOAD_DIR:path.join(directory,'uploads'),IMAGE_STORAGE:'local',PAYPHONE_ENABLED:'false',EMAIL_VERIFICATION_ENABLED:'false',PERF_DIAGNOSTICS:'0',RENDER:'false'};
  const source=path.join(root,'server/prisma',postgres?'postgresql':''),schema=path.join(checkedDirectory(),'schema');
  let db;
  try{
    fs.mkdirSync(schema);fs.copyFileSync(path.join(source,'schema.prisma'),path.join(schema,'schema.prisma'));fs.cpSync(path.join(source,'migrations'),path.join(schema,'migrations'),{recursive:true});
    execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(schema,'schema.prisma')],{cwd:checkedDirectory(),env:isolated,stdio:'pipe',windowsHide:true});
    const seedCode=`require(${JSON.stringify(require.resolve('dotenv'))}).config=()=>({parsed:{}});require(${JSON.stringify(path.join(root,'server/prisma/seed.cjs'))});`;
    execFileSync(process.execPath,['-e',seedCode],{cwd:checkedDirectory(),env:isolated,stdio:'pipe',windowsHide:true});
    Object.assign(process.env,isolated);require('dotenv').config=()=>({parsed:{}});
    require('./geocoder-fixture.cjs')();db=require('../../server/models/db.cjs');const config=require('../../server/config.cjs')();
    const mail=require('../../server/models/email-delivery.cjs'),createApp=require('../../server/app.cjs'),supertest=require('supertest');
    const enabled=mail.configuration({NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'true',EMAIL_PUBLIC_ORIGIN:'http://localhost:3300',EMAIL_FROM:'confirmar@example.ec',RESEND_API_KEY:'re_synthetic_email_api_not_real'},{origins:config.origins});
    function api(verification=true){return supertest(createApp({...config,testAuthLimit:1000,testApiLimit:10000,emailVerification:verification?enabled:config.emailVerification}));}
    return {db,config,api,provider:postgres?'postgresql':'sqlite',directory,async close(){await db.$disconnect();removeDirectory();}};
  }catch{
    // The opt-in PostgreSQL database belongs to the caller's disposable cluster; never drop it.
    if(!db)removeDirectory();throw new Error('No se pudo preparar la base aislada de pruebas de correo.');
  }
}
module.exports={createFixture,postgresTestUrl};
