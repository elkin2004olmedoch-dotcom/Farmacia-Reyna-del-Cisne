const db=require('./db.cjs');
const {visibleWhere,discountWhere,effectivePrice}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {serializable}=require('./inventario.cjs');
const {allowsPromotion}=require('../../frontend/models/pharmacy-policy.js');
async function save(data,id){
  return db.$transaction(async tx=>{
    const product=await tx.producto.findFirst({where:{id:data.productoId,activo:true},select:{requiereReceta:true,controlado:true,biologico:true}});
    if(!product)throw new AppError(422,'INVALID_PRODUCT','Selecciona un producto disponible.');
    if(!allowsPromotion(product))throw new AppError(422,'PHARMACY_PROMOTION_RESTRICTED','Este producto requiere revisión profesional y no puede aparecer en campañas públicas.');
    return id?tx.promocion.update({where:{id},data}):tx.promocion.create({data});
  },serializable);
}
module.exports={
  async list() {const now=new Date();const [tax,campaigns]=await Promise.all([fiscal.current(db,now),db.promocion.findMany({where:visibleWhere(now),include:{producto:{include:{lotes:true,promociones:{where:discountWhere(now)}}}},orderBy:[{orden:'asc'},{id:'asc'}],take:100})]);return campaigns.map(({producto,...campaign})=>({...campaign,producto:effectivePrice(producto,producto.promociones,now,tax.tarifaGeneral)}));},
  find:id=>db.promocion.findUnique({where:{id}}),
  create:data=>save(data),
  update:(id,data)=>save(data,id),
  remove:id=>db.promocion.delete({where:{id}}),
};
