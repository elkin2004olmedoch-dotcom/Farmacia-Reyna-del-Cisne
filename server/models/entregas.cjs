const bcrypt=require('bcrypt');
const db=require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {inclusiveTax}=require('./fiscal.cjs');
const ACTIVE=['asignada','en_camino','en_destino'];
const GPS_CLEAR={latitud:null,longitud:null,precision:null,registradaAt:null,recibidaAt:null,gpsVersion:{increment:1}};
const driverSelect={id:true,nombre:true,email:true,telefono:true,activo:true};
const orderSelect={id:true,userId:true,estado:true,entrega:true,nombre:true,telefono:true,provincia:true,ciudad:true,direccion:true,latitudEntrega:true,longitudEntrega:true,updatedAt:true};
const deliveryInclude={pedido:{select:orderSelect}};
const normalize=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').trim().replace(/\s+/g,' ').toLowerCase();
const fail=(code,message,status=409)=>{throw new AppError(status,code,message);};
const notFound=()=>fail('NOT_FOUND','No se encontró el recurso.',404);
async function transaction(fn) {
 for(let attempt=0;attempt<3;attempt++)try{return await db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});}
 catch(error){if(['P2034','P2028','P1008'].includes(error.code)&&attempt<2)continue;throw error;}
}
async function actor(tx,user,allowed) {
 const current=await tx.usuario.findUnique({where:{id:user.id},select:{id:true,role:true,activo:true,tokenVersion:true}});
 if(!current?.activo || current.tokenVersion!==user.tokenVersion)fail('INVALID_TOKEN','Tu sesión ya no es válida.',401);
 if(!allowed.includes(current.role))fail('FORBIDDEN','No tienes permiso para esta acción.',403);
 return current;
}
async function shippingSnapshot(tx,buyer,tax,now) {
 if(buyer.delivery!=='delivery')return {costoEnvioCentavos:0};
 const zone=typeof buyer.zonaEntregaId==='string'?await tx.zonaEntrega.findUnique({where:{id:buyer.zonaEntregaId}}):null;
 if(!zone?.activa || normalize(zone.provincia)!==normalize(buyer.province) || normalize(zone.canton)!==normalize(buyer.city))fail('DELIVERY_OUTSIDE_COVERAGE','Selecciona una zona activa que corresponda a la provincia y cantón de tu dirección.');
 if(buyer.esperadoTarifaVersion!==zone.version)fail('DELIVERY_RATE_CHANGED','La tarifa de entrega cambió. Revisa el importe actualizado antes de confirmar nuevamente.');
 if(zone.tarifaCentavos===null)fail('DELIVERY_RATE_PENDING','La tarifa de entrega aún no está configurada. Coordina con la farmacia o elige retiro.');
 const fiscal=inclusiveTax(zone.tarifaCentavos,zone.ivaCategoria==='cero'?0:tax.tarifaGeneral);
 return {zonaEntregaId:zone.id,costoEnvioCentavos:zone.tarifaCentavos,envioIvaPorcentaje:fiscal.ivaPorcentaje,envioBaseImponible:fiscal.baseImponible,envioIvaMonto:fiscal.ivaMonto,...(buyer.consienteUbicacion===true&&buyer.latitudEntrega!=null?{latitudEntrega:buyer.latitudEntrega,longitudEntrega:buyer.longitudEntrega,ubicacionEntregaAceptadaAt:now}:{})};
}
async function zones(admin=false) {
 return db.zonaEntrega.findMany({where:admin?{}:{activa:true},orderBy:{nombre:'asc'},...(admin?{include:{tarifas:{orderBy:{version:'desc'}}}}:{select:{id:true,nombre:true,provincia:true,canton:true,tarifaCentavos:true,ivaCategoria:true,version:true,activa:true}})});
}
async function saveZone(id,input,user) {
 return transaction(async tx=>{
  await actor(tx,user,['admin']);
  const {esperadoVersion,...data}=input;
  let zone;
  if(id){
   const old=await tx.zonaEntrega.findUnique({where:{id}});if(!old)notFound();
   if(old.version!==esperadoVersion)fail('ZONE_CHANGED','La zona cambió; actualiza sus datos.');
   const changed=await tx.zonaEntrega.updateMany({where:{id,version:esperadoVersion},data:{...data,version:{increment:1}}});
   if(changed.count!==1)fail('ZONE_CHANGED','La zona cambió; actualiza sus datos.');
   zone=await tx.zonaEntrega.findUnique({where:{id}});
  }else zone=await tx.zonaEntrega.create({data});
  await tx.zonaEntregaTarifa.create({data:{zonaEntregaId:zone.id,version:zone.version,tarifaCentavos:zone.tarifaCentavos,ivaCategoria:zone.ivaCategoria,fundamentoIva:zone.fundamentoIva,actorId:user.id}});
  return zone;
 });
}
const drivers=()=>db.usuario.findMany({where:{role:'repartidor'},select:driverSelect,orderBy:{nombre:'asc'}});
async function createDriver(input,user){
 const {password,...data}=input,passwordHash=await bcrypt.hash(password,12);
 return transaction(async tx=>{await actor(tx,user,['admin']);return tx.usuario.create({data:{...data,passwordHash,role:'repartidor'},select:driverSelect});});
}
async function setDriverActive(id,activo,user){
 return transaction(async tx=>{
  await actor(tx,user,['admin']);
  const driver=await tx.usuario.findFirst({where:{id,role:'repartidor'}});if(!driver)notFound();
  if(driver.activo===activo)return Object.fromEntries(Object.keys(driverSelect).map(k=>[k,driver[k]]));
  if(!activo){
   if(await tx.entrega.count({where:{repartidorId:id,estado:{in:['en_camino','en_destino']}}}))fail('DRIVER_HAS_ACTIVE_DELIVERY','Finaliza o cancela las entregas en curso antes de desactivar.');
   await tx.entrega.updateMany({where:{repartidorId:id,estado:'asignada'},data:{repartidorId:null,version:{increment:1},...GPS_CLEAR}});
  }
  return tx.usuario.update({where:{id},data:{activo,tokenVersion:{increment:1}},select:driverSelect});
 });
}
function location(delivery,now=new Date()) {
 if(!ACTIVE.includes(delivery.estado)||!delivery.registradaAt||!delivery.recibidaAt||now-delivery.registradaAt>120000||now-delivery.recibidaAt>120000||delivery.registradaAt-now>15000)return null;
 return {latitud:delivery.latitud,longitud:delivery.longitud,precision:delivery.precision,registradaAt:delivery.registradaAt};
}
function dto(e) {
 const p=e.pedido,active=ACTIVE.includes(e.estado);
 return {id:e.id,pedidoId:e.pedidoId,repartidorId:e.repartidorId,estado:e.estado,version:e.version,gpsVersion:e.gpsVersion,asignadaAt:e.asignadaAt,salidaAt:e.salidaAt,llegadaAt:e.llegadaAt,finalizadaAt:e.finalizadaAt,estadoPedido:p.estado,ubicacion:location(e),destino:active?{nombre:p.nombre,telefono:p.telefono,provincia:p.provincia,ciudad:p.ciudad,direccion:p.direccion,latitud:p.latitudEntrega,longitud:p.longitudEntrega}:null};
}
async function owned(tx,id,user){
 const current=await actor(tx,user,['admin','repartidor']);
 const delivery=await tx.entrega.findFirst({where:{id,...(current.role==='repartidor'?{repartidorId:user.id}:{})},include:deliveryInclude});
 if(!delivery)notFound();return delivery;
}
async function list({page=1,pageSize=50,estado},user){
 const where={...(user.role==='repartidor'?{repartidorId:user.id}:{}),...(estado?{estado}:{})};
 const [items,total]=await db.$transaction([db.entrega.findMany({where,include:deliveryInclude,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.entrega.count({where})]);
 return {items:items.map(dto),total,page,pageSize};
}
async function assign({pedidoId,repartidorId,esperadoVersion},user){
 return transaction(async tx=>{
  await actor(tx,user,['admin']);
  const order=await tx.pedido.findUnique({where:{id:pedidoId},select:orderSelect});if(!order)notFound();
  if(order.entrega!=='delivery'||!['confirmado','preparado'].includes(order.estado))fail('ORDER_NOT_DELIVERABLE','Solo se asignan pedidos a domicilio confirmados o preparados.');
  if(!await tx.usuario.findFirst({where:{id:repartidorId,role:'repartidor',activo:true},select:{id:true}}))fail('DRIVER_UNAVAILABLE','Selecciona un repartidor activo.');
  const old=await tx.entrega.findUnique({where:{pedidoId},include:deliveryInclude});
  if(old){
   if(old.estado!=='asignada')fail('DELIVERY_ALREADY_STARTED','Solo se reasigna antes de salir.');
   if(old.repartidorId===repartidorId)return dto(old);
   if(old.version!==esperadoVersion)fail('DELIVERY_CHANGED','La entrega cambió; actualiza sus datos.');
   const changed=await tx.entrega.updateMany({where:{id:old.id,version:esperadoVersion,estado:'asignada'},data:{repartidorId,asignadaAt:new Date(),version:{increment:1},...GPS_CLEAR}});
   if(changed.count!==1)fail('DELIVERY_CHANGED','La entrega cambió; actualiza sus datos.');
   return dto(await tx.entrega.findUnique({where:{id:old.id},include:deliveryInclude}));
  }
  if(esperadoVersion!=null)fail('DELIVERY_CHANGED','La entrega no tiene la versión indicada.');
  return dto(await tx.entrega.create({data:{pedidoId,repartidorId},include:deliveryInclude}));
 });
}
async function changeState(id,{estado,esperadoVersion},user){
 return transaction(async tx=>{
  const e=await owned(tx,id,user);
  if(e.estado===estado)return dto(e);
  if(e.version!==esperadoVersion)fail('DELIVERY_CHANGED','La entrega cambió; actualiza sus datos.');
  const next={asignada:'en_camino',en_camino:'en_destino',en_destino:'entregada'};
  if(estado==='cancelada' ? user.role!=='admin'||!ACTIVE.includes(e.estado) : next[e.estado]!==estado)fail('INVALID_DELIVERY_TRANSITION','Ese cambio de estado no está permitido.');
  if(estado==='en_camino' && (!e.repartidorId||e.pedido.estado!=='preparado'))fail('ORDER_NOT_READY','El pedido debe estar preparado y tener repartidor antes de salir.');
  if(['entregada','cancelada'].includes(estado)){
   await require('./pedidos.cjs').updateStatusTx(tx,e.pedidoId,{estado:estado==='entregada'?'entregado':'cancelado',esperadoUpdatedAt:e.pedido.updatedAt.toISOString()},user.id);
  }else{
   if(!['confirmado','preparado'].includes(e.pedido.estado))fail('ORDER_NOT_DELIVERABLE','El pedido ya no admite entregas.');
   await require('./pedidos.cjs').assertOrderLotsCurrent(tx,e.pedidoId);
   const changed=await tx.entrega.updateMany({where:{id,version:esperadoVersion,estado:e.estado},data:{estado,version:{increment:1},...(estado==='en_camino'?{salidaAt:new Date()}:{llegadaAt:new Date()})}});
   if(changed.count!==1)fail('DELIVERY_CHANGED','La entrega cambió; actualiza sus datos.');
  }
  return dto(await tx.entrega.findUnique({where:{id},include:deliveryInclude}));
 });
}
async function setLocation(id,input,user){
 return transaction(async tx=>{
  await actor(tx,user,['repartidor']);const e=await owned(tx,id,user);
  if(!['en_camino','en_destino'].includes(e.estado))fail('GPS_NOT_ACTIVE','Solo puedes compartir ubicación durante la entrega.');
  const now=new Date(),registered=new Date(input.registradaAt);
  if(!Number.isFinite(registered.getTime())||now-registered>120000||registered-now>15000)fail('GPS_STALE','La muestra de ubicación está vencida o es futura.');
  if(e.gpsVersion!==input.esperadoGpsVersion||e.registradaAt&&registered<=e.registradaAt)fail('GPS_CHANGED','Actualiza el seguimiento antes de enviar otra ubicación.');
  if(e.recibidaAt&&now-e.recibidaAt<10000)fail('GPS_TOO_FREQUENT','Espera diez segundos entre muestras.',429);
  const changed=await tx.entrega.updateMany({where:{id,gpsVersion:input.esperadoGpsVersion,repartidorId:user.id,estado:{in:['en_camino','en_destino']}},data:{latitud:input.latitud,longitud:input.longitud,precision:input.precision,registradaAt:registered,recibidaAt:now,gpsVersion:{increment:1}}});
  if(changed.count!==1)fail('GPS_CHANGED','La ubicación cambió; actualiza el seguimiento.');
  return {gpsVersion:e.gpsVersion+1,ubicacion:{latitud:input.latitud,longitud:input.longitud,precision:input.precision,registradaAt:registered}};
 });
}
async function clearLocation(id,user){
 return transaction(async tx=>{
  await actor(tx,user,['repartidor']);await owned(tx,id,user);
  const e=await tx.entrega.update({where:{id},data:GPS_CLEAR,select:{gpsVersion:true}});
  return {...e,ubicacion:null};
 });
}
async function tracking(id,user){
 const p=await db.pedido.findFirst({where:{id,...(user.role==='admin'?{}:{userId:user.id})},select:{id:true,estado:true,reparto:true}});if(!p)notFound();
 const e=p.reparto;
 return {pedidoId:p.id,estadoPedido:p.estado,entrega:e?{id:e.id,estado:e.estado,version:e.version,asignadaAt:e.asignadaAt,salidaAt:e.salidaAt,llegadaAt:e.llegadaAt,finalizadaAt:e.finalizadaAt,ubicacion:location(e)}:null};
}
const purgeExpiredLocations=(now=new Date())=>db.entrega.updateMany({where:{recibidaAt:{lt:new Date(now.getTime()-15*60000)}},data:GPS_CLEAR});
module.exports={shippingSnapshot,zones,saveZone,drivers,createDriver,setDriverActive,list,assign,changeState,setLocation,clearLocation,tracking,purgeExpiredLocations};
