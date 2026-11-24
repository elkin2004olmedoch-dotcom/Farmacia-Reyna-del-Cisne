const db=require('./db.cjs');
const resources=require('./admin-resources.cjs');
const {AppError}=require('../middleware/errors.cjs');
function selected(name){const resource=resources.find(name);if(!resource)throw new AppError(422,'INVALID_RESOURCE','Selecciona un recurso administrativo válido.');return resource;}
const delegate=resource=>db[resource.model[0].toLowerCase()+resource.model.slice(1)];
const options=resource=>resource.options?resource.options():{select:resource.select};
const format=(resource,row)=>resource.format?resource.format(row):row;
async function list({tabla,page,pageSize}) {
 const resource=selected(tabla),model=delegate(resource);
 const [items,total]=await db.$transaction([model.findMany({...options(resource),skip:(page-1)*pageSize,take:pageSize,orderBy:{[resource.primaryKey]:'asc'}}),model.count()]);
 return {items:items.map(row=>format(resource,row)),total,page,pageSize,resource:resources.descriptor(resource)};
}
async function find(tabla,id){
 const resource=selected(tabla),item=await delegate(resource).findUnique({where:{[resource.primaryKey]:id},...options(resource)});
 if(!item)throw new AppError(404,'NOT_FOUND','No se encontró el registro.');
 return {item:format(resource,item),resource:resources.descriptor(resource)};
}
module.exports=Object.assign(list,{find,resources:resources.list});
