const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const express=require('express');
const {buildPages}=require('../../scripts/build-pages.cjs');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-'));
const output=path.join(directory,'pages');
const staticOrigin='http://127.0.0.1:3301',apiOrigin='http://127.0.0.1:3302';
Object.assign(process.env,{
  NODE_ENV:'test',IMAGE_STORAGE:'local',CORS_ORIGIN:staticOrigin+','+apiOrigin,
  DATABASE_URL:'file:'+path.join(directory,'pages.db').replaceAll('\\','/'),
  UPLOAD_DIR:path.join(directory,'uploads'),JWT_SECRET:randomBytes(48).toString('hex'),
  ADMIN_EMAIL:'admin-browser@example.ec',ADMIN_PASSWORD:'AdminBrowser2026!',
});

function headerRules(file){
  const rules=[];let rule;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    if(!line.trim() || line.trimStart().startsWith('#'))continue;
    if(!/^\s/.test(line)){
      const pattern=line.trim().split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
      rule={matches:new RegExp('^'+pattern+'$'),headers:[]};rules.push(rule);
    }else{
      const header=line.trim().match(/^([^:]+):\s*(.*)$/);
      if(!rule || !header)throw new Error('Invalid generated Pages header rule.');
      rule.headers.push([header[1],header[2]]);
    }
  }
  return rules;
}

let apiServer,staticServer;
async function close(server){if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
async function cleanup(){
  await Promise.all([close(staticServer),close(apiServer)]);
  const db=require('../../server/models/db.cjs');await db.$disconnect();
  if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-pages-'))fs.rmSync(directory,{recursive:true,force:true});
}
async function start(){
  for(const args of [['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],['server/prisma/seed.cjs']])execFileSync(process.execPath,args,{env:process.env,stdio:'pipe'});
  await buildPages({output,apiOrigin,allowLocal:true});
  const rules=headerRules(path.join(output,'_headers'));
  const settings={...require('../../server/config.cjs')(),testAuthLimit:200,testApiLimit:2000};
  apiServer=require('../../server/app.cjs')(settings).listen(3302,'127.0.0.1');
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    for(const rule of rules)if(rule.matches.test(req.path))for(const [name,value] of rule.headers)res.setHeader(name,value);
    if(/^\/api(?:\/|$)/.test(req.path) || /^\/assets\/uploads(?:\/|$)/.test(req.path) || ['/_headers','/_redirects'].includes(req.path)){res.sendStatus(404);return;}
    next();
  });
  app.use(express.static(output,{dotfiles:'deny',extensions:['html'],redirect:false,maxAge:0}));
  app.use((req,res)=>res.sendStatus(404));
  staticServer=app.listen(3301,'127.0.0.1');
}
start().catch(async()=>{console.error('Could not start isolated Pages fixture.');await cleanup();process.exitCode=1;});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>cleanup().then(()=>process.exit(0)));
