const db = require('./db.cjs');
module.exports = {
  async list({page,pageSize,q,categoria}) {
    const where={activo:true,...(categoria ? {categoria} : {}),...(q ? {OR:[{nombre:{contains:q}},{descripcion:{contains:q}}]} : {})};
    const [items,total]=await db.$transaction([db.producto.findMany({where,orderBy:{createdAt:'asc'},skip:(page-1)*pageSize,take:pageSize}),db.producto.count({where})]);
    return {items,total,page,pageSize};
  },
  find:id=>db.producto.findFirst({where:{id,activo:true}}),
  create:data=>db.producto.create({data}),
  update:(id,data)=>db.producto.update({where:{id},data}),
  remove:id=>db.producto.update({where:{id},data:{activo:false,stock:0}}),
};
