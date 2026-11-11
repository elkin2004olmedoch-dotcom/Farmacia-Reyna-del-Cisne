const db=require('./db.cjs');
const {visibleWhere,discountWhere,effectivePrice,priceLots}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {serializable}=require('./inventario.cjs');
const {allowsPromotion}=require('../../frontend/models/pharmacy-policy.js');
async function save(data,id,expectedUpdatedAt){
  return db.$transaction(async tx=>{
    const current=id?await tx.promocion.findUnique({where:{id}}):null;
    if(id&&!current)throw new AppError(404,'NOT_FOUND','No se encontró la promoción.');
    const product=await tx.producto.findFirst({where:{id:data.productoId??current?.productoId,activo:true},select:{requiereReceta:true,controlado:true,biologico:true}});
    if(!product)throw new AppError(422,'INVALID_PRODUCT','Selecciona un producto disponible.');
    if(!allowsPromotion(product))throw new AppError(422,'PHARMACY_PROMOTION_RESTRICTED','Este producto requiere revisión profesional y no puede aparecer en campañas públicas.');
    if(!id)return tx.promocion.create({data});
    const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
    const changed=await tx.promocion.updateMany({where:{id,updatedAt:expectedUpdatedAt?new Date(expectedUpdatedAt):current.updatedAt},data:{...data,updatedAt}});
    if(changed.count!==1)throw new AppError(409,'PROMOTION_CHANGED','La promoción cambió. Actualiza sus datos antes de guardar.');
    return tx.promocion.findUnique({where:{id}});
  },serializable);
}
module.exports={
  async list() {const now=new Date();const [tax,campaigns]=await Promise.all([fiscal.current(db,now),db.promocion.findMany({where:visibleWhere(now),include:{producto:{include:{lotes:priceLots(now),promociones:{where:discountWhere(now)}}}},orderBy:[{orden:'asc'},{id:'asc'}],take:100})]);return campaigns.map(({producto,...campaign})=>({...campaign,producto:effectivePrice(producto,producto.promociones,now,tax.tarifaGeneral)}));},
  find:id=>db.promocion.findUnique({where:{id}}),
  create:data=>save(data),
  update:(id,data,expectedUpdatedAt)=>save(data,id,expectedUpdatedAt),
  remove:id=>db.promocion.delete({where:{id}}),
};
