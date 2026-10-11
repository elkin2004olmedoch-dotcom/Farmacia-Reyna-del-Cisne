const db=require('./db.cjs');
module.exports={
 async list({page,pageSize}){const [items,total]=await db.$transaction([db.proveedor.findMany({orderBy:{nombre:'asc'},skip:(page-1)*pageSize,take:pageSize}),db.proveedor.count()]);return {items,total,page,pageSize};},
 create:data=>db.proveedor.create({data}),
 update:(id,data)=>db.proveedor.update({where:{id},data}),
};
