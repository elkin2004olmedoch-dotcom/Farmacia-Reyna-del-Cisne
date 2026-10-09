const db = require('./db.cjs');
const {Prisma}=require('@prisma/client');
const {AppError}=require('../middleware/errors.cjs');
module.exports = {
  async list({page,pageSize,q,categoria}) {
    const where={activo:true,...(categoria ? {categoria} : {}),...(q ? {OR:[{nombre:{contains:q}},{descripcion:{contains:q}}]} : {})};
    const [items,total]=await db.$transaction([db.producto.findMany({where,orderBy:{createdAt:'asc'},skip:(page-1)*pageSize,take:pageSize}),db.producto.count({where})]);
    return {items,total,page,pageSize};
  },
  find:id=>db.producto.findFirst({where:{id,activo:true}}),
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
