const db = require('./db.cjs');
const {Prisma}=require('@prisma/client');
const {AppError}=require('../middleware/errors.cjs');
const {discountWhere,effectivePrice}=require('./prices.cjs');
module.exports = {
  async list({page,pageSize,q,categoria}) {
    const now=new Date();
    const where={activo:true,...(categoria ? {categoria} : {}),...(q ? {OR:[{nombre:{contains:q}},{descripcion:{contains:q}}]} : {})};
    const [items,total]=await db.$transaction([db.producto.findMany({where,include:{promociones:{where:discountWhere(now)}},orderBy:{createdAt:'asc'},skip:(page-1)*pageSize,take:pageSize}),db.producto.count({where})]);
    return {items:items.map(product=>effectivePrice(product,product.promociones,now)),total,page,pageSize};
  },
  async find(id) {const now=new Date();const product=await db.producto.findFirst({where:{id,activo:true},include:{promociones:{where:discountWhere(now)}}});return product?effectivePrice(product,product.promociones,now):null;},
  create:data=>db.producto.create({data}),
  async update(id,data,expectedUpdatedAt) {
    if(!expectedUpdatedAt)return db.producto.update({where:{id},data});
    return db.$transaction(async tx=> {
      const updated=await tx.producto.updateMany({where:{id,activo:true,updatedAt:new Date(expectedUpdatedAt)},data});
      if(updated.count!==1)throw new AppError(409,'PRODUCT_CHANGED','El producto cambió mientras lo editabas. Cierra y vuelve a abrir la edición para cargar el stock actual antes de guardar.');
      return tx.producto.findUnique({where:{id}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  },
  remove:id=>db.producto.update({where:{id},data:{activo:false,stock:0}}),
};
