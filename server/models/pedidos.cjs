const {createHash}=require('node:crypto');
const {Prisma}=require('./prisma-client.cjs');
const db=require('./db.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {discountWhere,effectivePrice}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const inventory=require('./inventario.cjs');
const {requiresProfessionalReview,restrictionReason}=require('../../frontend/models/pharmacy-policy.js');
const include={pagoPractica:true,detalles:{include:{lotes:true}},historial:{orderBy:[{createdAt:'asc'},{id:'asc'}]}};
const transitions={pendiente:['confirmado','cancelado'],confirmado:['preparado','cancelado'],preparado:['entregado','cancelado'],entregado:[],cancelado:[]};
async function create(userId,{carrito,comprador,claveSolicitud,pago,esperadoTotalCentavos},{actor}={}) {
  const payments=require('./pagos.cjs');
  if(payments.practiceAvailable()&&!pago)throw new AppError(409,'CHECKOUT_PAYMENT_REQUIRED','Completa el pago antes de confirmar la compra.');
  if(pago&&(!payments.practiceAvailable()||!payments.validPractice(pago)))throw new AppError(422,'CHECKOUT_PAYMENT_INVALID','El método de pago no está disponible.');
  if(pago&&(!Number.isSafeInteger(esperadoTotalCentavos)||esperadoTotalCentavos<1))throw new AppError(422,'CHECKOUT_TOTAL_REQUIRED','Revisa el total antes de pagar.');
  const sorted=[...carrito].sort((a,b)=>a.productoId.localeCompare(b.productoId));
  const fingerprint=createHash('sha256').update(JSON.stringify({carrito:sorted,...(pago?{pago,esperadoTotalCentavos}:{}),comprador:Object.fromEntries(Object.entries(comprador).sort())})).digest('hex');
  function same(existing) {
    if(existing.fingerprint!==fingerprint)throw new AppError(409,'IDEMPOTENCY_CONFLICT','Esta confirmación ya se usó para otro pedido.');
    return {pedido:existing,replayed:true};
  }
  let destination=null;
  if(comprador.delivery==='delivery'){
    const prior=await db.pedido.findUnique({where:{userId_requestKey:{userId,requestKey:claveSolicitud}},include});if(prior)return same(prior);
    destination=await require('./geocoding.cjs').prepare(comprador);
    if(!destination)throw new AppError(409,'DELIVERY_PICKUP_REQUIRED','No pudimos localizar el destino. Seleccionamos retiro en farmacia; revisa el total y confirma nuevamente.');
  }
  for(let attempt=0;attempt<3;attempt++) {
    try {
      return await db.$transaction(async tx=> {
        const current=await tx.usuario.findUnique({where:{id:userId},select:{activo:true,role:true,tokenVersion:true}});
        if(!current?.activo||!['user','admin'].includes(current.role)||actor&&actor.tokenVersion!==current.tokenVersion)throw new AppError(401,'INVALID_TOKEN','Tu sesión ya no es válida.');
        if(actor?.webSession&&!await require('./sesiones-web.cjs').checkTx(tx,actor.webSession,userId,actor.tokenVersion))throw new AppError(401,'INVALID_TOKEN','Tu sesión web ya no es válida.');
        const prior=await tx.pedido.findUnique({where:{userId_requestKey:{userId,requestKey:claveSolicitud}},include});
        if(prior)return same(prior);
        const now=new Date();
        const products=await tx.producto.findMany({where:{id:{in:sorted.map(item=>item.productoId)},activo:true},include:{lotes:true,promociones:{where:discountWhere(now)}}});
        const tax=await fiscal.current(tx,now);
        const shipping=await require('./entregas.cjs').shippingSnapshot(tx,comprador,tax,now,destination);
        let cents=0,baseCents=0,ivaCents=0;const details=[];
        for(const item of sorted) {
          const product=products.find(product=>product.id===item.productoId);
          if(!product)throw new AppError(409,'PRODUCT_UNAVAILABLE','Uno de los productos ya no está disponible.');
          if(product.requiereReceta)throw new AppError(409,'PRESCRIPTION_REQUIRED',`${product.nombre} requiere receta. Coordina con la farmacia la revisión de la receta y su dispensación presencial.`);
          if(requiresProfessionalReview(product))throw new AppError(409,'PROFESSIONAL_REVIEW_REQUIRED',restrictionReason(product));
          const priced=effectivePrice(product,product.promociones,now,tax.tarifaGeneral);
          const unit=Math.round(Number(priced.precio)*100);
          const reserved=await inventory.reserve(tx,product,item.cantidad,now);
          const lineTax=fiscal.inclusiveTax(unit*item.cantidad,priced.ivaPorcentaje);
          cents+=unit*item.cantidad;
          baseCents+=Math.round(Number(lineTax.baseImponible)*100);ivaCents+=Math.round(Number(lineTax.ivaMonto)*100);
          details.push({productoId:product.id,nombreProducto:product.nombre,cantidad:item.cantidad,precioUnitario:new Prisma.Decimal(unit).div(100),precioOriginal:priced.precioOriginal,descuentoPorcentaje:priced.descuentoPorcentaje,...lineTax,totalLinea:new Prisma.Decimal(unit*item.cantidad).div(100),lotes:{create:reserved.allocations}});
        }
        const subtotalProductos=new Prisma.Decimal(cents).div(100);
        cents+=shipping.costoEnvioCentavos;
        baseCents+=Math.round(Number(shipping.envioBaseImponible||0)*100);ivaCents+=Math.round(Number(shipping.envioIvaMonto||0)*100);
        if(pago&&cents!==esperadoTotalCentavos)throw new AppError(409,'CHECKOUT_TOTAL_CHANGED','El total cambió. Revisa productos y envío antes de pagar nuevamente.');
        const pedido=await tx.pedido.create({data:{...(pago?{pagoPractica:{create:{metodo:pago.metodo,marca:pago.marca||null,totalCentavos:cents}}}:{}),userId,subtotalProductos,...shipping,total:new Prisma.Decimal(cents).div(100),baseImponible:new Prisma.Decimal(baseCents).div(100),ivaMonto:new Prisma.Decimal(ivaCents).div(100),requestKey:claveSolicitud,fingerprint,createdAt:now,updatedAt:now,entrega:comprador.delivery,nombre:comprador.name,email:comprador.email.toLowerCase(),telefono:require('../../frontend/models/ecuador.js').normalizePhone(comprador.phone),documento:'••••••'+comprador.document.slice(-4),provincia:comprador.delivery==='delivery'?comprador.province:null,ciudad:comprador.delivery==='delivery'?comprador.city:null,direccion:comprador.delivery==='delivery'?comprador.address:null,codigoPostal:comprador.delivery==='delivery'?comprador.postalCode || null:null,detalles:{create:details},historial:{create:{estado:'pendiente',actorId:userId,createdAt:now}}},include});
        await inventory.saleMovements(tx,pedido.detalles,pedido.id,userId);
        await require('./entregas.cjs').autoAssign(tx,pedido);
        return {pedido,replayed:false};
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});
    } catch(error) {
      if(['P2002','P2034','P2028','P1008'].includes(error.code)) {
        const prior=await db.pedido.findUnique({where:{userId_requestKey:{userId,requestKey:claveSolicitud}},include});
        if(prior)return same(prior);
      }
      if(['P2034','P2028','P1008'].includes(error.code) && attempt<2)continue;
      throw error;
    }
  }
}
async function list({page,pageSize},userId) {
  const where=userId ? {userId} : {};
  const [items,total]=await db.$transaction([db.pedido.findMany({where,include,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.pedido.count({where})]);
  return {items,total,page,pageSize};
}
async function updateStatus(id,{estado,esperadoUpdatedAt},actorId) {
  for(let attempt=0;attempt<3;attempt++) {
    try {
      return await db.$transaction(async tx=> {
        return updateStatusTx(tx,id,{estado,esperadoUpdatedAt},actorId);
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});
    } catch(error) {if(['P2034','P2028','P1008'].includes(error.code) && attempt<2)continue;throw error;}
  }
}
async function updateStatusTx(tx,id,{estado,esperadoUpdatedAt},actorId) {
  const current=await tx.pedido.findUnique({where:{id},include});
  if(!current)throw new AppError(404,'NOT_FOUND','No se encontró el pedido.');
  // Repeating the same transition is safe and never returns stock twice.
  if(current.estado===estado)return {pedido:current,replayed:true};
  const expected=new Date(esperadoUpdatedAt);
  if(current.updatedAt.getTime()!==expected.getTime())throw new AppError(409,'ORDER_CHANGED','El pedido cambió. Actualiza sus datos antes de cambiar el estado.');
  if(!transitions[current.estado]?.includes(estado))throw new AppError(409,'INVALID_ORDER_TRANSITION','Ese cambio de estado no está permitido. Los pedidos entregados o cancelados son definitivos.');
  if(estado==='cancelado') {
    const payment=await tx.pago.findUnique({where:{pedidoId:id},select:{estado:true,entorno:true}});
    if(payment && payment.entorno==='production' && payment.estado!=='cancelado')throw new AppError(409,'PAYMENT_REQUIRES_RECONCILIATION','El pedido tiene un pago aprobado o en proceso. Coordina su conciliación o devolución antes de cancelar y devolver el inventario.');
    const invoice=await tx.facturaPedido.findUnique({where:{pedidoId:id},select:{estado:true,secuencial:true,xmlFirmado:true,procesandoHasta:true}});
    if(invoice && (invoice.secuencial!==null || invoice.xmlFirmado || invoice.estado==='AUTORIZADA' || invoice.procesandoHasta && invoice.procesandoHasta>new Date()))throw new AppError(409,'INVOICE_REQUIRES_RECONCILIATION','El pedido tiene una factura emitida o en proceso. Gestiona la anulación o nota de crédito correspondiente antes de devolver el inventario.');
  }
  if(estado!=='cancelado')await assertOrderLotsCurrent(tx,id);
  const delivery=await tx.entrega.findUnique({where:{pedidoId:id}});
  if(estado==='entregado' && delivery && delivery.estado!=='en_destino')throw new AppError(409,'DELIVERY_NOT_ARRIVED','La entrega debe estar en destino para finalizar.');
  const changedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
  const changed=await tx.pedido.updateMany({where:{id,estado:current.estado,updatedAt:expected},data:{estado,updatedAt:changedAt,...(['cancelado','entregado'].includes(estado)?{latitudEntrega:null,longitudEntrega:null}:{})}});
  if(changed.count!==1)throw new AppError(409,'ORDER_CHANGED','El pedido cambió. Actualiza sus datos antes de cambiar el estado.');
  if(delivery && ['cancelado','entregado'].includes(estado))await tx.entrega.update({where:{id:delivery.id},data:{estado:estado==='cancelado'?'cancelada':'entregada',finalizadaAt:changedAt,version:{increment:1},...require('./sesiones-moviles.cjs').GPS_CLEAR}});
  if(estado==='cancelado')await inventory.restore(tx,current.detalles,id,actorId);
  await tx.pedidoEstado.create({data:{pedidoId:id,anterior:current.estado,estado,actorId,createdAt:changedAt}});
  if(['confirmado','preparado'].includes(estado))await require('./entregas.cjs').autoAssign(tx,{...current,estado});
  return {pedido:await tx.pedido.findUnique({where:{id},include}),replayed:false};
}
async function assertOrderLotsCurrent(tx,pedidoId) {
  if(await tx.lote.count({where:{detalles:{some:{detalle:{pedidoId}}},vencimiento:{lt:inventory.ecuadorDay()}}}))throw new AppError(409,'LOT_EXPIRED_ORDER','El pedido contiene un lote que venció después de la reserva. Cancélalo y coordina una nueva dispensación con unidades vigentes.');
}
module.exports={create,list,updateStatus,updateStatusTx,assertOrderLotsCurrent};
