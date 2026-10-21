const {randomUUID} = require('node:crypto');
const {performance}=require('node:perf_hooks');
const diagnostics=require('../diagnostics.cjs');
const timedRoutes=new Set(['/','/index.html','/api/salud','/api/productos','/api/promociones','/api/auth/me','/api/auth/login','/api/auth/register']);
module.exports = function logger(req,res,next) {
  req.id=randomUUID();res.setHeader('X-Request-Id',req.id);
  const start=performance.now();const tracing=diagnostics.enabled();
  if(tracing){
    const kind=req.path.startsWith('/api/')?'api':'static';
    const fields={requestId:req.id,method:['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(req.method)?req.method:'OTHER',kind,route:timedRoutes.has(req.path)?req.path:kind};
    diagnostics.emit('http_start',fields);res.setHeader('X-Diagnostic-Boot',diagnostics.bootId);
    const writeHead=res.writeHead;
    res.writeHead=function(...args){
      if(!res.headersSent){const durationMs=diagnostics.elapsed(start);res.setHeader('Server-Timing',`express_headers;dur=${durationMs}`);diagnostics.emit('http_headers',{...fields,durationMs});}
      return writeHead.apply(this,args);
    };
    res.on('finish',()=>diagnostics.emit('http_finish',{...fields,status:res.statusCode,durationMs:diagnostics.elapsed(start)}));
    res.on('close',()=>{if(!res.writableFinished)diagnostics.emit('http_close',{...fields,completed:false,durationMs:diagnostics.elapsed(start)});});
  }
  res.on('finish',()=> {
    if(!tracing && process.env.NODE_ENV!=='test') console.info(JSON.stringify({level:'info',requestId:req.id,method:req.method,path:req.path,status:res.statusCode,ms:diagnostics.elapsed(start)}));
  });
  next();
};
