const db=require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const relation={producto:{select:{id:true,nombre:true}},proveedor:{select:{id:true,nombre:true}}};
const movementSelect={id:true,productoId:true,actorId:true,pedidoId:true,tipo:true,cantidad:true,motivo:true,createdAt:true,producto:{select:{id:true,nombre:true}},movimientoLote:{select:{loteId:true,lote:{select:{id:true,numero:true}}}},actor:{select:{nombre:true,email:true}}};
function movementDto({movimientoLote,...row}){return {...row,loteId:movimientoLote?.loteId??null,lote:movimientoLote?.lote??null};}
function movementData({loteId,...row}){return {...row,...(loteId?{movimientoLote:{create:{loteId}}}:{})};}
const serializable={isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000};
function ecuadorDay(now=new Date()){return new Date(now.getTime()-5*60*60*1000).toISOString().slice(0,10);}
function sellableStock(product,now=new Date()) {return Math.max(0,product.stock-(product.lotes || []).filter(lot=>lot.vencimiento<ecuadorDay(now)).reduce((sum,lot)=>sum+lot.stock,0));}
const trackedStock=product=>(product.lotes || []).reduce((sum,lot)=>sum+lot.stock,0);
function purchaseDetails(lot,cantidadRecibida){
 const costoTotalCentavos=cantidadRecibida==null?null:lot.costoUnitario.mul(100).round().mul(cantidadRecibida).toNumber();
 return {...lot,cantidadRecibida,costoTotalCentavos};
}
async function listLots({page,pageSize,productoId}) {
 const where=productoId?{productoId}:{};
 const [items,total]=await db.$transaction([db.lote.findMany({where,include:relation,orderBy:[{vencimiento:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.lote.count({where})]);
 // El ingreso original conserva la cantidad comprada después de ventas y ajustes.
 const receipts=items.length?await db.$queryRaw`SELECT ml."loteId", MIN(m."cantidad") AS cantidad
   FROM "MovimientoLote" ml JOIN "MovimientoInventario" m ON m."id"=ml."movimientoId"
   JOIN "Lote" l ON l."id"=ml."loteId" AND l."productoId"=m."productoId"
   WHERE ml."loteId" IN (${Prisma.join(items.map(lot=>lot.id))})
     AND m."tipo"='entrada' AND m."motivo"=('Ingreso de lote ' || l."numero")
   GROUP BY ml."loteId" HAVING COUNT(*)=1`:[];
 const quantities=new Map(receipts.map(row=>[row.loteId,Number(row.cantidad)]));
 return {items:items.map(lot=>purchaseDetails(lot,quantities.get(lot.id)??null)),total,page,pageSize};
}
async function listMovements({page,pageSize,productoId}) {
 const where=productoId?{productoId}:{};
 const [items,total]=await db.$transaction([db.movimientoInventario.findMany({where,select:movementSelect,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.movimientoInventario.count({where})]);
 return {items:items.map(movementDto),total,page,pageSize};
}
async function findProduct(tx,id){const product=await tx.producto.findFirst({where:{id,activo:true},include:{lotes:true}});if(!product)throw new AppError(404,'NOT_FOUND','El producto no está disponible.');return product;}
async function createLot({productoId,numero,vencimiento,cantidad,costoUnitario,proveedorId},actorId) {
 return db.$transaction(async tx=> {
  await findProduct(tx,productoId);
  if(proveedorId && !await tx.proveedor.findFirst({where:{id:proveedorId,activo:true}}))throw new AppError(422,'SUPPLIER_UNAVAILABLE','Selecciona un proveedor activo.');
  if(vencimiento<ecuadorDay())throw new AppError(422,'LOT_EXPIRED','No puedes ingresar un lote vencido.');
  const changed=await tx.producto.updateMany({where:{id:productoId,activo:true,stock:{lte:100000-cantidad}},data:{stock:{increment:cantidad},...(proveedorId?{proveedorId}:{})}});
  if(changed.count!==1)throw new AppError(409,'STOCK_LIMIT','El stock máximo permitido por producto es 100000 unidades.');
  const lot=await tx.lote.create({data:{productoId,numero,vencimiento,stock:cantidad,costoUnitario,proveedorId:proveedorId || null},include:relation});
  await tx.movimientoInventario.create({data:movementData({productoId,loteId:lot.id,actorId,tipo:'entrada',cantidad,motivo:'Ingreso de lote '+numero})});
  return purchaseDetails(lot,cantidad);
 },serializable);
}
async function adjust({productoId,loteId,tipo,cantidad,motivo},actorId) {
 return db.$transaction(async tx=> {
  const product=await findProduct(tx,productoId);
  const lot=loteId?product.lotes.find(value=>value.id===loteId):null;
  if(loteId && !lot)throw new AppError(422,'LOT_PRODUCT_MISMATCH','El lote seleccionado no pertenece al producto.');
  const available=lot?lot.stock:product.stock-trackedStock(product);
  if(tipo==='salida' && available<cantidad)throw new AppError(409,'INSUFFICIENT_STOCK','No hay suficientes unidades en ese saldo de inventario.');
  if(tipo==='entrada' && lot && lot.vencimiento<ecuadorDay())throw new AppError(422,'LOT_EXPIRED','No puedes añadir unidades a un lote vencido.');
  if(tipo==='entrada' && (product.stock+cantidad>100000 || lot && lot.stock+cantidad>100000))throw new AppError(409,'STOCK_LIMIT','El stock máximo permitido es 100000 unidades.');
  const delta=tipo==='entrada'?cantidad:-cantidad;
  if(tipo==='entrada')await tx.producto.update({where:{id:productoId},data:{stock:{increment:delta}}});
  if(lot)await tx.lote.update({where:{id:loteId},data:{stock:{increment:delta}}});
  if(tipo==='salida')await tx.producto.update({where:{id:productoId},data:{stock:{increment:delta}}});
  return movementDto(await tx.movimientoInventario.create({data:movementData({productoId,loteId,actorId,tipo,cantidad,motivo}),include:{movimientoLote:true}}));
 },serializable);
}
async function reserve(tx,product,quantity,now) {
 if(sellableStock(product,now)<quantity)throw new AppError(409,'INSUFFICIENT_STOCK',`No hay suficientes unidades vigentes de ${product.nombre}.`);
 let remaining=quantity;const allocations=[];
 for(const lot of [...(product.lotes || [])].filter(lot=>lot.vencimiento>=ecuadorDay(now) && lot.stock>0).sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento) || a.id.localeCompare(b.id))) {
  if(!remaining)break;
  const units=Math.min(remaining,lot.stock);
  const updated=await tx.lote.updateMany({where:{id:lot.id,stock:{gte:units}},data:{stock:{decrement:units}}});
  if(updated.count!==1)throw new AppError(409,'INSUFFICIENT_STOCK','La disponibilidad del lote cambió. Revisa el carrito.');
  allocations.push({loteId:lot.id,cantidad:units});remaining-=units;
 }
 const changed=await tx.producto.updateMany({where:{id:product.id,activo:true,stock:{gte:quantity}},data:{stock:{decrement:quantity}}});
 if(changed.count!==1)throw new AppError(409,'INSUFFICIENT_STOCK',`No hay suficientes unidades de ${product.nombre}.`);
 return {allocations,untracked:remaining};
}
async function saleMovements(tx,details,pedidoId,actorId) {
 for(const line of details) {
  let remaining=line.cantidad;
  for(const allocation of line.lotes || []) {remaining-=allocation.cantidad;await tx.movimientoInventario.create({data:movementData({productoId:line.productoId,loteId:allocation.loteId,pedidoId,actorId,tipo:'venta',cantidad:allocation.cantidad,motivo:'Reserva de unidades del pedido'})});}
  if(remaining>0)await tx.movimientoInventario.create({data:{productoId:line.productoId,pedidoId,actorId,tipo:'venta',cantidad:remaining,motivo:'Reserva de unidades sin lote del pedido'}});
 }
}
async function restore(tx,details,pedidoId,actorId) {
 for(const line of details) {
  const current=await tx.producto.findUnique({where:{id:line.productoId},select:{stock:true}});
  if(current.stock+line.cantidad>100000)throw new AppError(409,'STOCK_LIMIT','La devolución supera el stock máximo. Revisa el inventario antes de cancelar.');
  await tx.producto.update({where:{id:line.productoId},data:{stock:{increment:line.cantidad}}});
  let remaining=line.cantidad;
  for(const allocation of line.lotes || []) {
   remaining-=allocation.cantidad;
   await tx.lote.update({where:{id:allocation.loteId},data:{stock:{increment:allocation.cantidad}}});
   await tx.movimientoInventario.create({data:movementData({productoId:line.productoId,loteId:allocation.loteId,pedidoId,actorId,tipo:'devolucion',cantidad:allocation.cantidad,motivo:'Devolución por cancelación del pedido'})});
  }
  if(remaining>0)await tx.movimientoInventario.create({data:{productoId:line.productoId,pedidoId,actorId,tipo:'devolucion',cantidad:remaining,motivo:'Devolución sin lote por cancelación del pedido'}});
 }
}
module.exports={ecuadorDay,sellableStock,trackedStock,listLots,listMovements,createLot,adjust,reserve,saleMovements,restore,serializable,movementSelect,movementDto};
