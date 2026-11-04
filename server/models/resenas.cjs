'use strict';
const db=require('./db.cjs');
const {transaction}=require('./sesiones-moviles.cjs');
const {AppError}=require('../middleware/errors.cjs');
const ownSelect={id:true,productoId:true,detalleId:true,puntuacion:true,comentario:true,createdAt:true,updatedAt:true};
const eligibleWhere=(userId,productoId)=>({productoId,pedido:{userId,estado:'entregado'}});
const missing=()=>{throw new AppError(404,'NOT_FOUND','No se encontró la reseña.');};
const author=nombre=>{const words=nombre.trim().split(/\s+/);return words[0]+(words[1]?' '+Array.from(words[1])[0]+'.':'');};
module.exports={
 async list(productoId,{page,pageSize}){
  if(!await db.producto.findFirst({where:{id:productoId,activo:true},select:{id:true}}))missing();
  const where={productoId,detallePedido:{pedido:{estado:'entregado'}}};
  const [summary,items]=await db.$transaction([db.resenaProducto.aggregate({where,_count:{_all:true},_avg:{puntuacion:true}}),db.resenaProducto.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize,select:{puntuacion:true,comentario:true,createdAt:true,usuario:{select:{nombre:true}}}})]);
  return {promedio:summary._avg.puntuacion===null?null:Math.round(summary._avg.puntuacion*10)/10,total:summary._count._all,page,pageSize,items:items.map(({usuario,...item})=>({...item,autor:author(usuario.nombre),compraVerificada:true}))};
 },
 async eligibility(userId,productoId){
  const [detail,resena]=await Promise.all([db.pedidoDetalle.findFirst({where:eligibleWhere(userId,productoId),orderBy:[{pedido:{createdAt:'desc'}},{id:'asc'}],select:{id:true}}),db.resenaProducto.findUnique({where:{userId_productoId:{userId,productoId}},select:ownSelect})]);
  return {detalleId:resena?.detalleId||detail?.id||null,resena};
 },
 async create(userId,{productoId,detalleId,puntuacion,comentario=''}){
  try{return await transaction(async tx=>{
   if(!await tx.pedidoDetalle.findFirst({where:{id:detalleId,...eligibleWhere(userId,productoId)},select:{id:true}}))throw new AppError(403,'VERIFIED_PURCHASE_REQUIRED','Sólo puedes reseñar productos de una compra tuya entregada.');
   return tx.resenaProducto.create({data:{userId,productoId,detalleId,puntuacion,comentario},select:ownSelect});
  });}catch(error){if(error.code==='P2002')throw new AppError(409,'REVIEW_EXISTS','Ya publicaste una reseña de este producto. Puedes editarla.');throw error;}
 },
 update:(userId,id,{puntuacion,comentario=''})=>transaction(async tx=>{const current=await tx.resenaProducto.findFirst({where:{id,userId},select:{productoId:true,detalleId:true}});if(!current)missing();if(!await tx.pedidoDetalle.findFirst({where:{id:current.detalleId,...eligibleWhere(userId,current.productoId)},select:{id:true}}))throw new AppError(403,'VERIFIED_PURCHASE_REQUIRED','La compra debe seguir entregada para editar esta reseña.');if((await tx.resenaProducto.updateMany({where:{id,userId},data:{puntuacion,comentario}})).count!==1)missing();return tx.resenaProducto.findFirst({where:{id,userId},select:ownSelect});}),
 async remove(userId,id){if((await db.resenaProducto.deleteMany({where:{id,userId}})).count!==1)missing();},
};
