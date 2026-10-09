const {createHash}=require('node:crypto');
const {Prisma}=require('@prisma/client');
const db=require('./db.cjs');
const {AppError}=require('../middleware/errors.cjs');
const include={detalles:true};
async function create(userId,{carrito,comprador,claveSolicitud}) {
  const sorted=[...carrito].sort((a,b)=>a.productoId.localeCompare(b.productoId));
  const fingerprint=createHash('sha256').update(JSON.stringify({carrito:sorted,comprador:Object.fromEntries(Object.entries(comprador).sort())})).digest('hex');
  function same(existing) {
    if(existing.fingerprint!==fingerprint)throw new AppError(409,'IDEMPOTENCY_CONFLICT','Esta confirmación ya se usó para otro pedido.');
    return {pedido:existing,replayed:true};
  }
  for(let attempt=0;attempt<3;attempt++) {
    try {
      return await db.$transaction(async tx=> {
        const prior=await tx.pedido.findUnique({where:{userId_requestKey:{userId,requestKey:claveSolicitud}},include});
        if(prior)return same(prior);
        const products=await tx.producto.findMany({where:{id:{in:sorted.map(item=>item.productoId)},activo:true}});
        let cents=0;const details=[];
        for(const item of sorted) {
          const product=products.find(product=>product.id===item.productoId);
          if(!product)throw new AppError(409,'PRODUCT_UNAVAILABLE','Uno de los productos ya no está disponible.');
          const unit=Math.round(Number(product.precio)*100);
          const result=await tx.producto.updateMany({where:{id:product.id,activo:true,stock:{gte:item.cantidad}},data:{stock:{decrement:item.cantidad}}});
          if(result.count!==1)throw new AppError(409,'INSUFFICIENT_STOCK',`No hay suficientes unidades de ${product.nombre}.`);
          cents+=unit*item.cantidad;
          details.push({productoId:product.id,nombreProducto:product.nombre,cantidad:item.cantidad,precioUnitario:new Prisma.Decimal(unit).div(100)});
        }
        const pedido=await tx.pedido.create({data:{userId,total:new Prisma.Decimal(cents).div(100),requestKey:claveSolicitud,fingerprint,entrega:comprador.delivery,nombre:comprador.name,email:comprador.email.toLowerCase(),telefono:require('../../frontend/models/ecuador.js').normalizePhone(comprador.phone),documento:'••••••'+comprador.document.slice(-4),provincia:comprador.delivery==='delivery'?comprador.province:null,ciudad:comprador.delivery==='delivery'?comprador.city:null,direccion:comprador.delivery==='delivery'?comprador.address:null,codigoPostal:comprador.delivery==='delivery'?comprador.postalCode || null:null,detalles:{create:details}},include});
        return {pedido,replayed:false};
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});
    } catch(error) {
      if(error.code==='P2002') {
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
  const [items,total]=await db.$transaction([db.pedido.findMany({where,include,orderBy:{createdAt:'desc'},skip:(page-1)*pageSize,take:pageSize}),db.pedido.count({where})]);
  return {items,total,page,pageSize};
}
module.exports={create,list};
