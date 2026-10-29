const {randomUUID} = require('node:crypto');
const {performance}=require('node:perf_hooks');
const diagnostics=require('../diagnostics.cjs');
const timedRoutes=new Set(['/','/index.html','/api/salud','/api/productos','/api/promociones','/api/auth/me','/api/auth/login','/api/auth/register']);
const adminWrites=new Map([
  ['POST /api/productos','product.create'],['PUT /api/productos/:id','product.update'],['DELETE /api/productos/:id','product.delete'],
  ['POST /api/promociones','promotion.create'],['PUT /api/promociones/:id','promotion.update'],['DELETE /api/promociones/:id','promotion.delete'],
  ['POST /api/admin/imagenes','image.upload'],['POST /api/admin/configuracion/fiscal','fiscal.configuration.create'],
  ['POST /api/admin/proveedores','supplier.create'],['PUT /api/admin/proveedores/:id','supplier.update'],
  ['POST /api/admin/lotes','inventory.lot.create'],['POST /api/admin/inventario/ajustes','inventory.adjust'],
  ['PUT /api/pedidos/:id/estado','order.status.update'],
  ['POST /api/pedidos/:id/pago/payphone','payment.start'],
  ['PUT /api/admin/facturacion/configuracion','billing.configuration.update'],['POST /api/admin/facturacion/certificado','billing.certificate.upload'],
  ['POST /api/admin/facturacion/facturas','billing.invoice.create'],['POST /api/admin/facturacion/facturas/:id/emitir','billing.invoice.emit'],
  ['POST /api/admin/zonas-entrega','delivery.zone.create'],['PUT /api/admin/zonas-entrega/:id','delivery.zone.update'],
  ['POST /api/admin/repartidores','delivery.courier.create'],['PUT /api/admin/repartidores/:id','delivery.courier.update'],
  ['POST /api/entregas/asignar','delivery.assign'],['PUT /api/entregas/:id/estado','delivery.state.update'],
]);
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
    // Audit only fixed route templates and the database-authenticated administrator, never request contents.
    const template=typeof req.route?.path==='string'?req.route.path:'';
    // Express restores baseUrl while propagating errors; registered templates remain available.
    const route=template.startsWith('/api/')?template:'/api'+template;
    const action=adminWrites.get(req.method+' '+route);
    if(action && req.user?.role==='admin')console.info(JSON.stringify({level:'info',event:'admin_write',at:new Date().toISOString(),requestId:req.id,actorId:req.user.id,action,route,status:res.statusCode}));
  });
  next();
};
