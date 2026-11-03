const db=require('./db.cjs');
module.exports={
 record:data=>db.auditoriaAdmin.create({data}),
 async list({page,pageSize}){const [items,total]=await db.$transaction([db.auditoriaAdmin.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize}),db.auditoriaAdmin.count()]);const actors=await db.usuario.findMany({where:{id:{in:[...new Set(items.map(row=>row.actorId))]}},select:{id:true,nombre:true}});return {items:items.map(({actorId,ruta,...row})=>({...row,actor:{nombre:actors.find(user=>user.id===actorId)?.nombre||'Administrador'}})),total,page,pageSize};}
};
