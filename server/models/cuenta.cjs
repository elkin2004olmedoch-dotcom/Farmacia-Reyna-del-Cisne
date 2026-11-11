'use strict';
const db=require('./db.cjs');
const {transaction}=require('./sesiones-moviles.cjs');
const {AppError}=require('../middleware/errors.cjs');
const prices=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const {requiresProfessionalReview}=require('../../frontend/models/pharmacy-policy.js');
const addressSelect={id:true,alias:true,provincia:true,ciudad:true,direccion:true,codigoPostal:true,createdAt:true,updatedAt:true};
const productSelect={id:true,nombre:true,precio:true,stock:true,imagen:true,alt:true,activo:true,requiereReceta:true,controlado:true,biologico:true,cadenaFrio:true,descuentoPorcentaje:true,ivaCategoria:true};
const productPricing=now=>({...productSelect,promociones:{where:prices.discountWhere(now),select:{id:true,activa:true,vistaPrevia:true,descuentoPorcentaje:true,orden:true,inicio:true,fin:true}},lotes:prices.priceLots(now)});
const missing=()=>{throw new AppError(404,'NOT_FOUND','No se encontró el registro.');};
module.exports={
 listAddresses:userId=>db.direccionGuardada.findMany({where:{userId},select:addressSelect,orderBy:[{createdAt:'desc'},{id:'asc'}]}),
 createAddress:(userId,values)=>transaction(async tx=>{if(await tx.direccionGuardada.count({where:{userId}})>=10)throw new AppError(409,'ADDRESS_LIMIT','Puedes guardar hasta diez direcciones.');return tx.direccionGuardada.create({data:{userId,...values,codigoPostal:values.codigoPostal||null},select:addressSelect});}),
 updateAddress:(userId,id,{esperadoUpdatedAt,...values})=>transaction(async tx=>{
  const current=await tx.direccionGuardada.findFirst({where:{id,userId},select:{updatedAt:true}});if(!current)missing();
  const expected=new Date(esperadoUpdatedAt);if(current.updatedAt.getTime()!==expected.getTime())throw new AppError(409,'ADDRESS_CHANGED','Esta dirección cambió. Vuelve a cargarla antes de guardar.');
  const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
  const changed=await tx.direccionGuardada.updateMany({where:{id,userId,updatedAt:expected},data:{...values,codigoPostal:values.codigoPostal||null,updatedAt}});
  if(changed.count!==1)throw new AppError(409,'ADDRESS_CHANGED','Esta dirección cambió. Vuelve a cargarla antes de guardar.');
  return tx.direccionGuardada.findFirst({where:{id,userId},select:addressSelect});
 }),
 removeAddress:async(userId,id)=>{if((await db.direccionGuardada.deleteMany({where:{id,userId}})).count!==1)missing();},
 async favorites(userId){
  const now=new Date();
  const [items,tax]=await Promise.all([
   db.favorito.findMany({where:{userId},orderBy:[{createdAt:'desc'},{id:'asc'}],select:{productoId:true,createdAt:true,producto:{select:productPricing(now)}}}),
   fiscal.current(db,now),
  ]);
  return items.map(item=>({productoId:item.productoId,createdAt:item.createdAt,producto:prices.effectivePrice(item.producto,undefined,now,tax.tarifaGeneral)}));
 },
 async favorite(userId,productoId){return transaction(async tx=>{if(!await tx.producto.findFirst({where:{id:productoId,activo:true},select:{id:true}}))missing();return tx.favorito.upsert({where:{userId_productoId:{userId,productoId}},create:{userId,productoId},update:{},select:{productoId:true,createdAt:true}});});},
 removeFavorite:(userId,productoId)=>db.favorito.deleteMany({where:{userId,productoId}}),
 async reorder(userId,id){
  const now=new Date(),purchase=await db.pedido.findFirst({where:{id,userId},select:{id:true,detalles:{orderBy:{id:'asc'},select:{productoId:true,nombreProducto:true,cantidad:true,precioUnitario:true,producto:{select:productPricing(now)}}}}});if(!purchase)missing();
  const items=purchase.detalles.map(line=>{
   const product=prices.effectivePrice(line.producto,undefined,now),incidencias=[];
   if(!product.activo)incidencias.push('RETIRADO');if(requiresProfessionalReview(product))incidencias.push('RESTRINGIDO');
   if(product.stock<line.cantidad)incidencias.push('STOCK_INSUFICIENTE');
   const precioAnteriorCentavos=Math.round(Number(line.precioUnitario)*100),precioActualCentavos=Math.round(Number(product.precio)*100);
   if(precioAnteriorCentavos!==precioActualCentavos)incidencias.push('PRECIO_CAMBIO');
   return {productoId:line.productoId,nombre:product.nombre,cantidadSolicitada:line.cantidad,cantidadPermitida:incidencias.some(code=>['RETIRADO','RESTRINGIDO'].includes(code))?0:Math.min(line.cantidad,product.stock,99),stock:product.stock,precioAnteriorCentavos,precioActualCentavos,incidencias};
  });
  return {pedidoId:purchase.id,items};
 },
};
