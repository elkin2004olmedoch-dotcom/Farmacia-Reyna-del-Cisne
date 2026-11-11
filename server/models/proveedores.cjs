const db=require('./db.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {serializable}=require('./inventario.cjs');
async function update(id,data,expectedUpdatedAt){
 return db.$transaction(async tx=>{
  const current=await tx.proveedor.findUnique({where:{id},select:{updatedAt:true}});
  if(!current)throw new AppError(404,'NOT_FOUND','No se encontró el proveedor.');
  const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
  const changed=await tx.proveedor.updateMany({where:{id,updatedAt:expectedUpdatedAt?new Date(expectedUpdatedAt):current.updatedAt},data:{...data,updatedAt}});
  if(changed.count!==1)throw new AppError(409,'SUPPLIER_CHANGED','El proveedor cambió. Actualiza sus datos antes de guardar.');
  return tx.proveedor.findUnique({where:{id}});
 },serializable);
}
module.exports={
 async list({page,pageSize}){const [items,total]=await db.$transaction([db.proveedor.findMany({orderBy:[{nombre:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.proveedor.count()]);return {items,total,page,pageSize};},
 find:id=>db.proveedor.findUnique({where:{id}}),
 create:data=>db.proveedor.create({data}),
 update,
 async remove(id,expectedUpdatedAt){
  const current=await db.proveedor.findUnique({where:{id},select:{activo:true}});
  if(!current)throw new AppError(404,'NOT_FOUND','No se encontró el proveedor.');
  if(!current.activo)return;
  await update(id,{activo:false},expectedUpdatedAt);
 },
};
