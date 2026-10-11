const db=require('./db.cjs');
const {visibleWhere,discountWhere,effectivePrice}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
module.exports={
  async list() {const now=new Date();const [tax,campaigns]=await Promise.all([fiscal.current(db,now),db.promocion.findMany({where:visibleWhere(now),include:{producto:{include:{lotes:true,promociones:{where:discountWhere(now)}}}},orderBy:[{orden:'asc'},{id:'asc'}],take:100})]);return campaigns.map(({producto,...campaign})=>({...campaign,producto:effectivePrice(producto,producto.promociones,now,tax.tarifaGeneral)}));},
  find:id=>db.promocion.findUnique({where:{id}}),
  create:data=>db.promocion.create({data}),
  update:(id,data)=>db.promocion.update({where:{id},data}),
  remove:id=>db.promocion.delete({where:{id}}),
};
