const db=require('./db.cjs');
module.exports={
  list:()=>{const now=new Date();return db.promocion.findMany({where:{activa:true,producto:{activo:true},AND:[{OR:[{inicio:null},{inicio:{lte:now}}]},{OR:[{fin:null},{fin:{gt:now}}]}]},include:{producto:true},orderBy:{orden:'asc'},take:100});},
  find:id=>db.promocion.findUnique({where:{id}}),
  create:data=>db.promocion.create({data}),
  update:(id,data)=>db.promocion.update({where:{id},data}),
  remove:id=>db.promocion.delete({where:{id}}),
};
