'use strict';
const db=require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const provider=require('./payphone.cjs');
const select={id:true,userId:true,estado:true,total:true,subtotalProductos:true,costoEnvioCentavos:true,ivaMonto:true,envioIvaPorcentaje:true,envioBaseImponible:true,envioIvaMonto:true,createdAt:true,updatedAt:true,pago:true,detalles:{select:{nombreProducto:true,cantidad:true,precioUnitario:true,totalLinea:true,ivaPorcentaje:true,baseImponible:true,ivaMonto:true}}};
function cents(value) {const decimal=new Prisma.Decimal(value).mul(100);if(!decimal.isInteger() || decimal.lt(0) || decimal.gt(2147483647))throw new AppError(409,'PAYMENT_SNAPSHOT_INVALID','El importe histórico necesita revisión de la farmacia.');return decimal.toNumber();}
async function owned(client,id,user) {
 const pedido=await client.pedido.findFirst({where:{id,...(user.role==='admin'?{}:{userId:user.id})},select});
 if(!pedido)throw new AppError(404,'NOT_FOUND','No se encontró el pedido.');return pedido;
}
function dto(pedido) {
 const pago=pedido.pago,config=provider.configuration();
 return {pedido:{id:pedido.id,estado:pedido.estado,createdAt:pedido.createdAt,total:pedido.total,totalCentavos:Math.round(Number(pedido.total)*100),subtotalCentavos:Math.round(Number(pedido.subtotalProductos ?? pedido.total)*100),costoEnvioCentavos:pedido.costoEnvioCentavos,ivaCentavos:pedido.ivaMonto===null?null:Math.round(Number(pedido.ivaMonto)*100),moneda:'USD',detalles:pedido.detalles.map(line=>({nombreProducto:line.nombreProducto,cantidad:line.cantidad,totalCentavos:Math.round(Number(line.totalLinea ?? new Prisma.Decimal(line.precioUnitario).mul(line.cantidad))*100)}))},pago:pago?{estado:pago.estado,proveedor:pago.proveedor,entorno:pago.entorno,moneda:pago.moneda,totalCentavos:pago.totalCentavos,createdAt:pago.createdAt,updatedAt:pago.updatedAt,urlPago:config.available && config.environment===pago.entorno && pago.estado==='pendiente' && pago.urlPago?provider.hostedUrl(pago.urlPago,pago.paymentId):null}:null,...provider.publicConfiguration()};
}
async function find(id,user) {return dto(await owned(db,id,user));}
function snapshot(pedido) {
 let sinIvaCentavos=0,baseIvaCentavos=0,ivaCentavos=0;
 const lines=[...pedido.detalles];
 if(pedido.costoEnvioCentavos)lines.push({ivaPorcentaje:pedido.envioIvaPorcentaje,baseImponible:pedido.envioBaseImponible,ivaMonto:pedido.envioIvaMonto,totalLinea:new Prisma.Decimal(pedido.costoEnvioCentavos).div(100)});
 if(!lines.length)throw new AppError(409,'PAYMENT_SNAPSHOT_INVALID','El pedido necesita revisión de sus impuestos antes de pagar.');
 for(const line of lines) {
  if(![0,13,14,15].includes(line.ivaPorcentaje) || line.baseImponible===null || line.ivaMonto===null || line.totalLinea===null)throw new AppError(409,'PAYMENT_SNAPSHOT_INVALID','El pedido necesita revisión de sus impuestos antes de pagar.');
  const base=cents(line.baseImponible),tax=cents(line.ivaMonto),total=cents(line.totalLinea);
  if(base+tax!==total || (line.ivaPorcentaje===0 && tax!==0))throw new AppError(409,'PAYMENT_SNAPSHOT_INVALID','El desglose del pedido necesita revisión de la farmacia.');
  if(line.ivaPorcentaje===0)sinIvaCentavos+=base;else {baseIvaCentavos+=base;ivaCentavos+=tax;}
 }
 const totalCentavos=cents(pedido.total);
 if(totalCentavos<1 || totalCentavos!==sinIvaCentavos+baseIvaCentavos+ivaCentavos || pedido.ivaMonto===null || cents(pedido.ivaMonto)!==ivaCentavos)throw new AppError(409,'PAYMENT_SNAPSHOT_INVALID','El total del pedido necesita revisión de la farmacia.');
 return {totalCentavos,sinIvaCentavos,baseIvaCentavos,ivaCentavos};
}
async function transaction(work) {
 for(let attempt=0;attempt<3;attempt++)try{return await db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});}catch(error){if(['P2034','P2028','P1008','P2002'].includes(error.code) && attempt<2)continue;throw error;}
}
async function start(id,user) {
 // Authorize even when the provider is disabled, before revealing order details.
 await owned(db,id,user);const config=provider.requireAvailable();
 const reserved=await transaction(async tx=>{
  const pedido=await owned(tx,id,user);
  if(pedido.pago) {
   if(pedido.pago.entorno!==config.environment)throw new AppError(409,'PAYMENT_ENVIRONMENT_CHANGED','El pago corresponde a otro ambiente. Coordina su revisión con la farmacia antes de continuar.');
   return {pago:pedido.pago,created:false};
  }
  if(['cancelado','entregado'].includes(pedido.estado))throw new AppError(409,'PAYMENT_ORDER_CLOSED','Este pedido ya está cerrado. Coordina el pago con la farmacia.');
  const amounts=snapshot(pedido),updatedAt=new Date(Math.max(Date.now(),pedido.updatedAt.getTime()+1));
  const lock=await tx.pedido.updateMany({where:{id,estado:pedido.estado,updatedAt:pedido.updatedAt},data:{updatedAt}});
  if(lock.count!==1)throw new AppError(409,'ORDER_CHANGED','El pedido cambió. Actualiza sus datos antes de pagar.');
  return {pago:await tx.pago.create({data:{pedidoId:id,entorno:config.environment,...amounts}}),created:true};
 });
 if(reserved.created) {
  const pago=reserved.pago;
  try {
   const prepared=await provider.post('Prepare',{amount:pago.totalCentavos,amountWithoutTax:pago.sinIvaCentavos,amountWithTax:pago.baseIvaCentavos,tax:pago.ivaCentavos,service:0,tip:0,currency:'USD',clientTransactionId:pago.id,storeId:config.storeId,reference:'Pedido '+id,responseUrl:new URL('/api/pagos/payphone/respuesta',config.apiOrigin).href,cancellationUrl:provider.storefront(id)},config);
   if(typeof prepared.paymentId!=='string' || prepared.paymentId.length<1 || prepared.paymentId.length>200)throw new Error('PAYPHONE_RESPONSE');
   const urlPago=provider.hostedUrl(prepared.payWithCard,prepared.paymentId);if(!urlPago)throw new Error('PAYPHONE_REDIRECT');
   await db.pago.updateMany({where:{id:pago.id,estado:'creando'},data:{estado:'pendiente',paymentId:prepared.paymentId,urlPago}});
  } catch {
   await db.pago.updateMany({where:{id:pago.id,estado:'creando'},data:{estado:'revision',revisionMotivo:'preparacion_incierta'}});
  }
 }
 return {data:await find(id,user),created:reserved.created};
}
async function confirm(transactionId,clientTransactionId) {
 const pago=await db.pago.findUnique({where:{id:clientTransactionId}});
 if(!pago)throw new AppError(404,'NOT_FOUND','No se encontró el pago.');
 // A return or a repeated callback is never proof of payment.
 if(pago.estado!=='pendiente' || pago.confirmacionIniciadaAt)return provider.storefront(pago.pedidoId);
 const config=provider.requireAvailable();
 if(config.environment!==pago.entorno)return provider.storefront(pago.pedidoId);
 const claimed=await db.pago.updateMany({where:{id:pago.id,estado:'pendiente',confirmacionIniciadaAt:null},data:{estado:'revision',providerTransactionId:transactionId,confirmacionIniciadaAt:new Date(),revisionMotivo:'confirmacion_en_curso'}});
 if(claimed.count!==1)return provider.storefront(pago.pedidoId);
 try {
  const response=await provider.post('V2/Confirm',{id:transactionId,clientTxId:pago.id},config);
  const matches=response.transactionId===transactionId && response.clientTransactionId===pago.id && response.amount===pago.totalCentavos && response.currency==='USD';
  const aprobado=matches && response.statusCode===3 && response.transactionStatus==='Approved';
  const cancelado=matches && response.statusCode===2 && response.transactionStatus==='Canceled';
  await db.pago.updateMany({where:{id:pago.id,estado:'revision',revisionMotivo:'confirmacion_en_curso',providerTransactionId:transactionId},data:{estado:aprobado?'aprobado':cancelado?'cancelado':'revision',confirmadaAt:aprobado || cancelado?new Date():null,revisionMotivo:aprobado || cancelado?null:'respuesta_no_coincide',urlPago:null}});
 } catch {await db.pago.updateMany({where:{id:pago.id,estado:'revision',revisionMotivo:'confirmacion_en_curso'},data:{revisionMotivo:'confirmacion_incierta',urlPago:null}});}
 return provider.storefront(pago.pedidoId);
}
module.exports={find,start,confirm};
