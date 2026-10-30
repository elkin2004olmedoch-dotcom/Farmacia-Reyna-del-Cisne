const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {db,directory}=require('./fixture.cjs');
const supertest=require('supertest');
after(async()=>{await db.$disconnect();const target=path.resolve(directory);if(target.startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'))fs.rmSync(target,{recursive:true,force:true});});

test('precios públicos no recuperan lotes vigentes o agotados y conservan importes y reserva',async()=>{
  const {id,createdAt,updatedAt,...seed}=await db.producto.findFirst();
  const product=await db.producto.create({data:{...seed,id:'auditoria-lotes',codigoInterno:null,nombre:'Auditoría lotes públicos',tipoProducto:'cuidado',requiereReceta:false,controlado:false,biologico:false,stock:20,precio:10,descuentoPorcentaje:10,ivaCategoria:'general'}});
  await db.lote.createMany({data:[
    {id:'auditoria-vencido',productoId:product.id,numero:'VENCIDO',vencimiento:'2020-01-01',stock:3,costoUnitario:1},
    {id:'auditoria-vigente',productoId:product.id,numero:'VIGENTE',vencimiento:'2090-01-01',stock:10,costoUnitario:1},
    ...Array.from({length:2000},(_,index)=>({productoId:product.id,numero:'AGOTADO-'+index,vencimiento:'2090-01-01',stock:0,costoUnitario:0})),
  ]});
  await db.promocion.create({data:{titulo:'Campaña lotes',descripcion:'Campaña sintética de auditoría',etiqueta:'Auditoría',productoId:product.id,descuentoPorcentaje:20,activa:true,vistaPrevia:false}});
  const loaded=[];
  const observed=db.$extends({query:{$allModels:{$allOperations:async({model,args,query})=>{
    const result=await query(args);
    if(model==='Producto' && args.include?.lotes)loaded.push(...(Array.isArray(result)?result:[result]).filter(Boolean).filter(row=>row.id===product.id).map(row=>row.lotes));
    if(model==='Promocion')loaded.push(...(Array.isArray(result)?result:[]).filter(row=>row.productoId===product.id && row.producto).map(row=>row.producto.lotes));
    return result;
  }}}});
  const dbModule=require.cache[require.resolve('../../server/models/db.cjs')];
  const modules=['../../server/models/productos.cjs','../../server/models/promociones.cjs'].map(file=>require.resolve(file));
  const originals=modules.map(file=>require.cache[file]);dbModule.exports=observed;
  modules.forEach(file=>delete require.cache[file]);
  try{
    const products=require('../../server/models/productos.cjs');const promotions=require('../../server/models/promociones.cjs');
    const listed=(await products.list({page:1,pageSize:4,q:product.nombre})).items[0];
    const detail=await products.find(product.id);const campaign=(await promotions.list()).find(row=>row.productoId===product.id).producto;
    for(const priced of [listed,detail,campaign]){
      assert.equal(priced.stock,17);assert.equal(Number(priced.precioOriginal),10);assert.equal(Number(priced.precio),8);
      assert.equal(Math.round((Number(priced.baseImponible)+Number(priced.ivaMonto))*100),800);
      assert.equal('lotes' in priced,false);
    }
    assert.equal(loaded.length,3);
    for(const lots of loaded){assert.equal(lots.length,1,'el historial de lotes no debe crecer la lectura de precios');assert.deepEqual(lots,[{stock:3,vencimiento:'2020-01-01'}]);}
    const inventory=require('../../server/models/inventario.cjs');
    const reservation=await db.$transaction(async tx=>inventory.reserve(tx,await tx.producto.findUnique({where:{id:product.id},include:{lotes:true}}),1,new Date()));
    assert.deepEqual(reservation.allocations,[{loteId:'auditoria-vigente',cantidad:1}]);
    assert.equal((await db.lote.findUnique({where:{id:'auditoria-vencido'}})).stock,3);
  }finally{dbModule.exports=db;modules.forEach((file,index)=>{if(originals[index])require.cache[file]=originals[index];else delete require.cache[file];});}
});

test('el stock vence al cambiar el día en Ecuador, conservando el lote durante todo su día',()=>{
  const {sellableStock}=require('../../server/models/inventario.cjs');
  const product={stock:10,lotes:[{vencimiento:'2030-01-01',stock:4}]};
  assert.equal(sellableStock(product,new Date('2030-01-02T04:59:59.999Z')),10);
  assert.equal(sellableStock(product,new Date('2030-01-02T05:00:00.000Z')),6);
});

test('páginas estables desempatan productos, pedidos y proveedores por identificador',async()=>{
  const {id,createdAt,updatedAt,...seed}=await db.producto.findFirst();
  const ids=['auditoria-empate-c','auditoria-empate-a','auditoria-empate-b'];const date=new Date('2035-01-01T12:00:00Z');
  await db.producto.createMany({data:ids.map(id=>({...seed,id,codigoInterno:null,nombre:'Empate de auditoría',createdAt:date}))});
  const user=await db.usuario.findFirst();
  await db.pedido.createMany({data:ids.map(id=>({id,userId:user.id,total:0,estado:'pendiente',entrega:'pickup',nombre:user.nombre,email:user.email,telefono:user.telefono,documento:'••••••0400',requestKey:randomUUID(),fingerprint:'auditoria',createdAt:date}))});
  await db.proveedor.createMany({data:ids.map((id,index)=>({id,nombre:'AAAA proveedor repetido',ruc:['0102030400001','0102030401001','0102030402001'][index],email:'audit@example.ec',telefono:'+593979275988',direccion:'Dirección sintética de auditoría'}))});
  const models=[
    [require('../../server/models/productos.cjs'),{q:'Empate de auditoría'}],
    [require('../../server/models/pedidos.cjs'),{}],
    [require('../../server/models/proveedores.cjs'),{}],
  ];
  for(const [model,filter] of models){
    const first=await model.list({...filter,page:1,pageSize:2});const second=await model.list({...filter,page:2,pageSize:2});
    assert.deepEqual([...first.items,...second.items].filter(row=>ids.includes(row.id)).map(row=>row.id),[...ids].sort());
  }
});

test('readiness conserva cuota propia cuando el tráfico comercial agotó su presupuesto',async()=>{
  const settings=require('../../server/config.cjs')();const request=supertest(require('../../server/app.cjs')({...settings,testApiLimit:2}));
  await request.get('/api/productos?pageSize=1').expect(200);await request.get('/api/productos?pageSize=1').expect(200);
  await request.get('/api/productos?pageSize=1').expect(429);
  await request.get('/api/salud').expect(200);
  let limited=false;for(let index=0;index<65;index++){const response=await request.get('/api/salud');if(response.status===429){limited=true;break;}assert.equal(response.status,200);}
  assert.equal(limited,true,'salud mantiene una barrera independiente contra abuso');
});

test('readiness informa indisponibilidad de base sin exponer su error',async()=>{
  const settings=require('../../server/config.cjs')();const request=supertest(require('../../server/app.cjs')(settings));
  const original=db.$queryRaw;db.$queryRaw=async()=>{throw new Error('synthetic-private-database-error');};
  try{const response=await request.get('/api/salud');assert.equal(response.status,503);assert.equal(response.body.ok,false);assert.equal(JSON.stringify(response.body).includes('synthetic-private'),false);}
  finally{db.$queryRaw=original;}
});
