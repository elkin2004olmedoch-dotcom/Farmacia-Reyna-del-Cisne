const {Prisma}=require('@prisma/client');
const db=require('./db.cjs');
const TIME_ZONE='America/Guayaquil';
const LOW_STOCK=5;
const ECUADOR_OFFSET_MS=5*60*60*1000;

function cents(value) {
  const amount=new Prisma.Decimal(value || 0).mul(100).toDecimalPlaces(0).toNumber();
  if(!Number.isSafeInteger(amount))throw new RangeError('El total supera el rango de centavos admitido.');
  return amount;
}

function months(now) {
  const local=new Date(now.getTime()-ECUADOR_OFFSET_MS);
  const formatter=new Intl.DateTimeFormat('es-EC',{month:'long',year:'numeric',timeZone:TIME_ZONE});
  return Array.from({length:6},(_,index)=> {
    const start=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()-5+index,1,5));
    const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1,5));
    return {start,end,periodo:`${start.getUTCFullYear()}-${String(start.getUTCMonth()+1).padStart(2,'0')}`,etiqueta:formatter.format(start)};
  });
}

module.exports=async function summary(now=new Date()) {
  if(!(now instanceof Date) || Number.isNaN(now.getTime()))throw new TypeError('La fecha del resumen no es válida.');
  const periods=months(now);
  const visibleCampaigns={activa:true,producto:{activo:true},AND:[{OR:[{inicio:null},{inicio:{lte:now}}]},{OR:[{fin:null},{fin:{gt:now}}]}]};
  // All counts, balances and lists describe the same database snapshot.
  return db.$transaction(async tx=> {
    const [groups,monthly,products,customers,administrators,lowStock,campaigns,alerts,recent]=await Promise.all([
      tx.pedido.groupBy({by:['estado'],_count:{_all:true},_sum:{total:true},orderBy:{estado:'asc'}}),
      Promise.all(periods.map(({start,end})=>tx.pedido.aggregate({where:{createdAt:{gte:start,lt:end}},_count:{_all:true},_sum:{total:true}}))),
      tx.producto.count({where:{activo:true}}),
      tx.usuario.count({where:{activo:true,role:'user'}}),
      tx.usuario.count({where:{activo:true,role:'admin'}}),
      tx.producto.count({where:{activo:true,stock:{lte:LOW_STOCK}}}),
      tx.promocion.count({where:visibleCampaigns}),
      tx.producto.findMany({where:{activo:true,stock:{lte:LOW_STOCK}},select:{id:true,nombre:true,stock:true},orderBy:[{stock:'asc'},{nombre:'asc'},{id:'asc'}],take:10}),
      tx.pedido.findMany({select:{id:true,nombre:true,total:true,estado:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:5}),
    ]);
    const states=groups.map(group=>({estado:group.estado,cantidad:group._count._all,totalCentavos:cents(group._sum.total)}));
    const total=states.reduce((sum,state)=>({cantidad:sum.cantidad+state.cantidad,totalCentavos:sum.totalCentavos+state.totalCentavos}),{cantidad:0,totalCentavos:0});
    if(!Number.isSafeInteger(total.totalCentavos))throw new RangeError('El total supera el rango de centavos admitido.');
    const trend=periods.map((period,index)=>({periodo:period.periodo,etiqueta:period.etiqueta,cantidad:monthly[index]._count._all,totalCentavos:cents(monthly[index]._sum.total)}));
    return {
      generadoEn:now.toISOString(),zonaHoraria:TIME_ZONE,umbralStock:LOW_STOCK,
      indicadores:{pedidosMes:{cantidad:trend[5].cantidad,totalCentavos:trend[5].totalCentavos},pedidosTotales:total,pedidosPendientes:states.find(state=>state.estado==='pendiente')?.cantidad || 0,productosActivos:products,clientesActivos:customers,administradoresActivos:administrators,stockBajo:lowStock,campanasVisibles:campaigns},
      estados:states,tendencia:trend,alertas:alerts,
      recientes:recent.map(({total,...order})=>({...order,totalCentavos:cents(total)})),
    };
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});
};
