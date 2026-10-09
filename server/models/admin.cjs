const db=require('./db.cjs');
const {publicFields}=require('./usuarios.cjs');
const tables={productos:db.producto,usuarios:db.usuario,pedidos:db.pedido,detalles:db.pedidoDetalle,promociones:db.promocion};
module.exports=async function list({tabla,page,pageSize}) {
  const model=tables[tabla];
  const options=tabla==='usuarios'?{select:publicFields}:tabla==='pedidos'?{include:{detalles:true}}:tabla==='promociones'?{include:{producto:true}}:{};
  const [items,total]=await db.$transaction([model.findMany({...options,skip:(page-1)*pageSize,take:pageSize,orderBy:{id:'asc'}}),model.count()]);
  // Las claves internas de reintento no son datos del panel.
  return {items:items.map(({requestKey,fingerprint,...row})=>row),total,page,pageSize};
};
