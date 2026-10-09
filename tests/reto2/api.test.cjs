const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const {app,db,request,directory}=require('./fixture.cjs');
const bcrypt=require('bcrypt');
const userInput={nombre:'Cliente Prueba',email:'cliente-test@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClientePrueba2026!'};
const buyer={name:'Cliente Prueba',email:userInput.email,phone:userInput.telefono,documentType:'cedula',document:userInput.cedula,delivery:'pickup',province:'',city:'',address:'',postalCode:''};
const productInput={nombre:'Producto de prueba',precio:7.25,stock:10,categoria:'bienestar',descripcion:'Producto creado para probar la API',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba'};
let adminToken,userToken,userId,productId,orderId;
const bearer=token=>'Bearer '+token;
test('login admin devuelve JWT firmado y no expone hash ni contraseña',async()=>{
  const res=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);
  adminToken=res.body.data.token;const claims=jwt.verify(adminToken,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-web'});
  assert.ok(claims.exp>claims.iat);assert.equal(res.body.data.usuario.role,'admin');assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
});
test('registro ecuatoriano crea usuario con bcrypt y no persiste cédula',async()=>{
  const res=await request.post('/api/auth/register').send(userInput).expect(201);userToken=res.body.data.token;userId=res.body.data.usuario.id;
  const user=await db.usuario.findUnique({where:{id:userId}});assert.equal(user.role,'user');assert.match(user.passwordHash,/^\$2[aby]\$12\$/);assert.ok(await bcrypt.compare(userInput.password,user.passwordHash));assert.ok(!JSON.stringify(user).includes(userInput.cedula));
  await request.post('/api/auth/register').send(userInput).expect(409);
});
test('registro rechaza roles inyectados, correo, cédula, teléfono y contraseña inválidos',async()=>{
  for(const patch of [{role:'admin'},{cedula:'0102030401'},{telefono:'1234567'},{email:'bad@'},{password:'corta'},{password:'Á1'.repeat(30)}]) {
    await request.post('/api/auth/register').send({...userInput,email:'otro@example.ec',...patch}).expect(422);
  }
});
test('credenciales incorrectas, login user y expiración/revocación se controlan',async()=>{
  await request.post('/api/auth/login').send({email:userInput.email,password:'Incorrecta123'}).expect(401);
  const valid=await request.post('/api/auth/login').send({email:userInput.email,password:userInput.password}).expect(200);userToken=valid.body.data.token;
  const expired=jwt.sign({version:0},process.env.JWT_SECRET,{subject:userId,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:-1});
  await request.get('/api/auth/me').set('Authorization',bearer(expired)).expect(401);
  await request.get('/api/auth/me').set('Authorization','Bearer invalido').expect(401);
  await request.get('/api/auth/me').set('Authorization',bearer(jwt.sign({version:0},process.env.JWT_SECRET,{subject:userId,algorithm:'HS384'}))).expect(401);
});
test('crear producto requiere JWT y rol admin; user recibe 403',async()=>{
  await request.post('/api/productos').send(productInput).expect(401);
  await request.post('/api/productos').set('Authorization',bearer(userToken)).send(productInput).expect(403);
  const res=await request.post('/api/productos').set('Authorization',bearer(adminToken)).send(productInput).expect(201);productId=res.body.data.id;
  assert.equal(Number(res.body.data.precio),7.25);assert.equal((await db.producto.findUnique({where:{id:productId}})).stock,10);
});
test('catálogo, ficha y paginación son públicos; validación de params/body es estricta',async()=>{
  const res=await request.get('/api/productos?pageSize=5').expect(200);assert.equal(res.body.data.items.length,5);assert.equal(res.body.data.total,19);
  await request.get('/api/productos/'+productId).expect(200);
  await request.get('/api/productos?pageSize=1000').expect(422);
  await request.get('/api/productos/id%3Bdrop').expect(422);
  for(const patch of [{precio:1.234},{stock:-1},{imagen:'javascript:alert(1)'},{nombre:''},{precio:'7.25'},{activo:false}])await request.post('/api/productos').set('Authorization',bearer(adminToken)).send({...productInput,...patch}).expect(422);
});
test('edición admin persiste y sanitiza texto',async()=>{
  const res=await request.put('/api/productos/'+productId).set('Authorization',bearer(adminToken)).send({...productInput,nombre:'<b>Producto editado</b>',precio:8.5}).expect(200);
  assert.equal(res.body.data.nombre,'Producto editado');assert.equal(Number((await db.producto.findUnique({where:{id:productId}})).precio),8.5);
});
test('edición de producto detecta stock cambiado por compra y otra sesión admin sin sobrescribirlo',async()=>{
  const created=await request.post('/api/productos').set('Authorization',bearer(adminToken)).send({...productInput,nombre:'Producto concurrencia',stock:20}).expect(201);
  const id=created.body.data.id;let pendingOrder;
  try {
    const snapshot=(await request.get('/api/productos/'+id).expect(200)).body.data;
    const bought=await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({carrito:[{productoId:id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()}).expect(201);pendingOrder=bought.body.data.id;
    const conflict=await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,nombre:snapshot.nombre,stock:20,precio:9.99,esperadoUpdatedAt:snapshot.updatedAt}).expect(409);
    assert.equal(conflict.body.error.code,'PRODUCT_CHANGED');
    let current=(await request.get('/api/productos/'+id).expect(200)).body.data;
    assert.equal(current.stock,19);assert.equal(Number(current.precio),productInput.precio);
    for(const value of ['2026-10-09','2026-02-30T10:00:00Z','2026-10-09T10:00:00','not-a-date',null])await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,stock:19,esperadoUpdatedAt:value}).expect(422);
    await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,stock:19,esperadoUpdatedAt:current.updatedAt,campoDesconocido:true}).expect(422);
    await request.post('/api/productos').set('Authorization',bearer(adminToken)).send({...productInput,esperadoUpdatedAt:current.updatedAt}).expect(422);
    const updated=await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,nombre:snapshot.nombre,stock:19,precio:9.99,esperadoUpdatedAt:current.updatedAt}).expect(200);
    await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,nombre:snapshot.nombre,stock:19,precio:11.11,esperadoUpdatedAt:current.updatedAt}).expect(409);
    current=(await request.get('/api/productos/'+id).expect(200)).body.data;
    assert.equal(current.stock,19);assert.equal(Number(current.precio),9.99);assert.equal(current.updatedAt,updated.body.data.updatedAt);
  } finally {
    if(pendingOrder){await db.pedidoDetalle.deleteMany({where:{pedidoId:pendingOrder}});await db.pedido.delete({where:{id:pendingOrder}});}
    await db.producto.delete({where:{id}});
  }
});
test('pedido exige login; el total se calcula en servidor y queda en BD con detalles',async()=>{
  const payload={carrito:[{productoId:productId,cantidad:2}],comprador:buyer,claveSolicitud:randomUUID()};
  await request.post('/api/pedidos').send(payload).expect(401);
  await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({...payload,total:0}).expect(422);
  const res=await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send(payload).expect(201);orderId=res.body.data.id;
  const order=await db.pedido.findUnique({where:{id:orderId},include:{detalles:true}});assert.equal(Number(order.total),17);assert.equal(order.detalles[0].cantidad,2);assert.equal(Number(order.detalles[0].precioUnitario),8.5);assert.equal((await db.producto.findUnique({where:{id:productId}})).stock,8);assert.ok(!JSON.stringify(order).includes(userInput.cedula));
  const replay=await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send(payload).expect(200);assert.equal(replay.body.data.id,orderId);assert.equal((await db.producto.findUnique({where:{id:productId}})).stock,8);
  await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({...payload,carrito:[{productoId:productId,cantidad:1}]}).expect(409);
});
test('carrito manipulado o incompleto y entrega ecuatoriana inválida no crean pedidos',async()=>{
  for(const patch of [{carrito:[]},{carrito:[{productoId:productId,cantidad:1.5}]},{carrito:[{productoId:productId,cantidad:1,precio:0}]},{carrito:[{productoId:productId,cantidad:1},{productoId:productId,cantidad:1}]},{comprador:{...buyer,document:'1234567890'}},{comprador:{...buyer,delivery:'delivery',province:'Pichincha',city:'Quito',address:'Calle 123 y parque',postalCode:'010101'}}])await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({carrito:[{productoId:productId,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID(),...patch}).expect(422);
});
test('stock insuficiente revierte toda la transacción y evita sobreventa concurrente',async()=>{
  const other=await db.producto.create({data:{...productInput,id:randomUUID(),stock:1}});
  const before=await db.producto.findUnique({where:{id:productId}});
  await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({carrito:[{productoId:productId,cantidad:1},{productoId:other.id,cantidad:2}],comprador:buyer,claveSolicitud:randomUUID()}).expect(409);
  assert.equal((await db.producto.findUnique({where:{id:productId}})).stock,before.stock);
  const results=await Promise.all([1,2].map(()=>request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({carrito:[{productoId:other.id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()})));
  assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,1);assert.equal((await db.producto.findUnique({where:{id:other.id}})).stock,0);
});
test('mis pedidos separa usuarios; admin ve pedidos y todas las tablas sin hashes',async()=>{
  const mine=await request.get('/api/pedidos/mis-pedidos').set('Authorization',bearer(userToken)).expect(200);assert.ok(mine.body.data.items.some(order=>order.id===orderId));
  const other=await request.post('/api/auth/register').send({...userInput,email:'otro-cliente@example.ec'}).expect(201);
  const empty=await request.get('/api/pedidos/mis-pedidos').set('Authorization',bearer(other.body.data.token)).expect(200);assert.equal(empty.body.data.total,0);
  await request.get('/api/pedidos').set('Authorization',bearer(userToken)).expect(403);
  const all=await request.get('/api/pedidos').set('Authorization',bearer(adminToken)).expect(200);assert.ok(all.body.data.total>=2);
  for(const tabla of ['productos','usuarios','pedidos','detalles','promociones']){
    await request.get('/api/admin/tablas?tabla='+tabla).set('Authorization',bearer(userToken)).expect(403);
    const rows=await request.get('/api/admin/tablas?tabla='+tabla).set('Authorization',bearer(adminToken)).expect(200);assert.ok(!JSON.stringify(rows.body).includes('passwordHash'));assert.ok(!JSON.stringify(rows.body).includes('fingerprint'));
  }
});
test('promociones CRUD admin publica solo campañas activas y vigentes',async()=>{
  const values={titulo:'Campaña de prueba',descripcion:'Nueva selección del catálogo',etiqueta:'Novedad',productoId:productId,activa:true,vistaPrevia:true,orden:0,inicio:null,fin:null};
  await request.post('/api/promociones').set('Authorization',bearer(userToken)).send(values).expect(403);
  const created=await request.post('/api/promociones').set('Authorization',bearer(adminToken)).send(values).expect(201);const id=created.body.data.id;
  assert.ok((await request.get('/api/promociones').expect(200)).body.data.some(p=>p.id===id));
  await request.put('/api/promociones/'+id).set('Authorization',bearer(adminToken)).send({...values,inicio:'2099-01-01T00:00:00-05:00'}).expect(200);
  assert.ok(!(await request.get('/api/promociones').expect(200)).body.data.some(p=>p.id===id));
  await request.put('/api/promociones/'+id).set('Authorization',bearer(adminToken)).send({...values,inicio:'2026-10-09T10:00:00-05:00',fin:'2026-10-08T10:00:00-05:00'}).expect(422);
  await request.delete('/api/promociones/'+id).set('Authorization',bearer(adminToken)).expect(204);
});
test('eliminación lógica impide nuevas compras y conserva detalle/precio histórico',async()=>{
  await request.delete('/api/productos/'+productId).set('Authorization',bearer(userToken)).expect(403);
  await request.delete('/api/productos/'+productId).set('Authorization',bearer(adminToken)).expect(204);
  await request.get('/api/productos/'+productId).expect(404);
  const order=await db.pedido.findUnique({where:{id:orderId},include:{detalles:true}});assert.equal(order.detalles[0].nombreProducto,'Producto editado');assert.equal(Number(order.detalles[0].precioUnitario),8.5);
  await request.post('/api/pedidos').set('Authorization',bearer(userToken)).send({carrito:[{productoId:productId,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()}).expect(409);
});
test('resumen ejecutivo exige admin y expone solo indicadores y listas públicas del panel',async()=>{
  await request.get('/api/admin/resumen').expect(401);
  await request.get('/api/admin/resumen').set('Authorization',bearer(userToken)).expect(403);
  const res=await request.get('/api/admin/resumen').set('Authorization',bearer(adminToken)).expect(200);
  const data=res.body.data;
  assert.equal(data.zonaHoraria,'America/Guayaquil');assert.equal(data.umbralStock,5);
  assert.ok(!Number.isNaN(Date.parse(data.generadoEn)));assert.equal(data.tendencia.length,6);
  assert.ok(data.indicadores.pedidosTotales.cantidad>=2);
  assert.ok(Number.isSafeInteger(data.indicadores.pedidosTotales.totalCentavos));
  assert.ok(data.alertas.length<=10);assert.ok(data.recientes.length<=5);
  for(const row of data.recientes)assert.deepEqual(Object.keys(row).sort(),['createdAt','estado','id','nombre','totalCentavos']);
  for(const privateField of ['passwordHash','fingerprint','requestKey','documento','telefono','email'])assert.ok(!JSON.stringify(data).includes(privateField));
});
test('resumen usa centavos, seis meses ecuatorianos, vigencia real y límites de alertas y pedidos',async()=>{
  const summary=require('../../server/models/admin-summary.cjs');
  const now=new Date('2030-01-01T04:30:00Z'); // Still December 31 in Ecuador.
  const baseline=await summary(now);
  const products=Array.from({length:12},(_,index)=>({...productInput,id:randomUUID(),nombre:`Auditoría A${String(index+1).padStart(2,'0')}`,stock:index===11?5:0}));
  const inactiveProduct={...productInput,id:randomUUID(),nombre:'Auditoría inactivo',stock:0,activo:false};
  const healthyProduct={...productInput,id:randomUUID(),nombre:'Auditoría stock suficiente',stock:6};
  const productIds=[...products,inactiveProduct,healthyProduct].map(product=>product.id);
  const users=[{role:'user',activo:true},{role:'user',activo:false},{role:'admin',activo:true}].map((values,index)=>({...values,id:randomUUID(),nombre:'Usuario de auditoría',email:`resumen-${index}@example.ec`,telefono:'0979275988',passwordHash:'hash-privado-de-fixture'}));
  const dates=['2029-07-01T05:00:00Z','2029-08-01T05:00:00Z','2029-09-01T05:00:00Z','2029-10-01T05:00:00Z','2029-11-01T05:00:00Z','2029-12-01T04:59:59Z','2029-12-01T05:00:00Z','2030-01-01T04:20:00Z','2030-01-01T05:00:00Z','2029-07-01T04:59:59Z'];
  const amounts=[0.10,0.20,0.30,1.11,2.22,3.33,4.44,5.55,6.66,7.77];
  const orders=dates.map((date,index)=>({id:randomUUID(),userId,total:amounts[index],estado:index===0?'entregado':index===1?'cancelado':'pendiente',entrega:'pickup',nombre:`Pedido de auditoría ${index}`,email:userInput.email,telefono:userInput.telefono,documento:'••••••0400',requestKey:randomUUID(),fingerprint:'huella-privada-de-fixture',createdAt:new Date(date)}));
  const promotionBase={titulo:'Campaña de auditoría',descripcion:'Prueba de vigencia',etiqueta:'Vista previa',productoId:products[0].id,activa:true,vistaPrevia:true};
  const promotions=[
    {inicio:new Date('2029-12-01T05:00:00Z'),fin:new Date('2030-01-02T05:00:00Z')},
    {inicio:new Date('2030-01-01T05:00:00Z')},
    {fin:new Date('2029-12-01T05:00:00Z')},
    {activa:false},
    {productoId:inactiveProduct.id},
    {fin:now},
    {inicio:now},
  ].map(values=>({...promotionBase,...values,id:randomUUID()}));
  try {
    await db.producto.createMany({data:[...products,inactiveProduct,healthyProduct]});
    await db.usuario.createMany({data:users});
    await db.pedido.createMany({data:orders});
    await db.promocion.createMany({data:promotions});
    const data=await summary(now);
    assert.equal(data.generadoEn,now.toISOString());
    assert.deepEqual(data.tendencia.map(({periodo,cantidad,totalCentavos})=>({periodo,cantidad,totalCentavos})),[
      {periodo:'2029-07',cantidad:1,totalCentavos:10},
      {periodo:'2029-08',cantidad:1,totalCentavos:20},
      {periodo:'2029-09',cantidad:1,totalCentavos:30},
      {periodo:'2029-10',cantidad:1,totalCentavos:111},
      {periodo:'2029-11',cantidad:2,totalCentavos:555},
      {periodo:'2029-12',cantidad:2,totalCentavos:999},
    ]);
    assert.deepEqual(data.indicadores.pedidosMes,{cantidad:2,totalCentavos:999});
    assert.deepEqual(data.indicadores.pedidosTotales,{cantidad:baseline.indicadores.pedidosTotales.cantidad+10,totalCentavos:baseline.indicadores.pedidosTotales.totalCentavos+3168});
    assert.equal(data.indicadores.pedidosPendientes,baseline.indicadores.pedidosPendientes+8);
    assert.equal(data.indicadores.productosActivos,baseline.indicadores.productosActivos+13);
    assert.equal(data.indicadores.clientesActivos,baseline.indicadores.clientesActivos+1);
    assert.equal(data.indicadores.administradoresActivos,baseline.indicadores.administradoresActivos+1);
    assert.equal(data.indicadores.stockBajo,baseline.indicadores.stockBajo+12);
    assert.equal(data.indicadores.campanasVisibles,baseline.indicadores.campanasVisibles+2);
    assert.deepEqual(data.alertas.map(product=>product.id),products.slice(0,10).map(product=>product.id));
    assert.deepEqual(data.recientes.map(order=>order.id),[8,7,6,5,4].map(index=>orders[index].id));
    assert.equal(data.estados.find(state=>state.estado==='entregado').totalCentavos,(baseline.estados.find(state=>state.estado==='entregado')?.totalCentavos || 0)+10);
    assert.equal(data.estados.find(state=>state.estado==='cancelado').totalCentavos,(baseline.estados.find(state=>state.estado==='cancelado')?.totalCentavos || 0)+20);
    const empty=await summary(new Date('2000-01-01T05:00:00Z'));
    assert.equal(empty.tendencia.length,6);assert.equal(empty.tendencia[5].periodo,'2000-01');
    assert.ok(empty.tendencia.every(month=>month.cantidad===0 && month.totalCentavos===0));
  } finally {
    await db.promocion.deleteMany({where:{id:{in:promotions.map(promotion=>promotion.id)}}});
    await db.pedido.deleteMany({where:{id:{in:orders.map(order=>order.id)}}});
    await db.producto.deleteMany({where:{id:{in:productIds}}});
    await db.usuario.deleteMany({where:{id:{in:users.map(user=>user.id)}}});
  }
});
test('CORS exacto, JSON incorrecto, tamaño y errores no filtran stacktraces',async()=>{
  const allowed=await request.get('/api/productos').set('Origin','http://localhost:3000').expect(200);assert.equal(allowed.headers['access-control-allow-origin'],'http://localhost:3000');assert.equal(allowed.headers['cache-control'],'no-store');
  const denied=await request.get('/api/productos').set('Origin','https://evil.example').expect(403);assert.ok(!denied.headers['access-control-allow-origin']);
  const invalid=await request.post('/api/auth/login').set('Content-Type','application/json').send('{broken').expect(400);assert.equal(invalid.body.ok,false);assert.ok(!JSON.stringify(invalid.body).includes('stack'));
  await request.post('/api/auth/login').send({email:'x'.repeat(40000),password:'x'}).expect(413);
  await request.get('/api/desconocido').expect(404);assert.ok(allowed.headers['content-security-policy']);assert.ok(!allowed.headers['x-powered-by']);
});
test('usuario, producto editado, promoción, pedido y stock siguen conectados después de reconectar Prisma',async()=>{
  const registered=await request.post('/api/auth/register').send({...userInput,email:'persistencia@example.ec'}).expect(201);
  const persistentUser=registered.body.data.usuario;const token=registered.body.data.token;
  const created=await request.post('/api/productos').set('Authorization',bearer(adminToken)).send({...productInput,nombre:'Producto persistente',stock:6}).expect(201);
  const id=created.body.data.id;let promotionId,persistentOrderId,reopened;
  try {
    const edited=await request.put('/api/productos/'+id).set('Authorization',bearer(adminToken)).send({...productInput,nombre:'Producto persistente editado',stock:6,precio:4.56,esperadoUpdatedAt:created.body.data.updatedAt}).expect(200);
    const campaign={titulo:'Campaña persistente',descripcion:'Publicación guardada en la base',etiqueta:'Novedad',productoId:id,activa:true,vistaPrevia:true,orden:1,inicio:null,fin:null};
    promotionId=(await request.post('/api/promociones').set('Authorization',bearer(adminToken)).send(campaign).expect(201)).body.data.id;
    await request.put('/api/promociones/'+promotionId).set('Authorization',bearer(adminToken)).send({...campaign,titulo:'Campaña persistente editada'}).expect(200);
    const order=await request.post('/api/pedidos').set('Authorization',bearer(token)).send({carrito:[{productoId:id,cantidad:2}],comprador:{...buyer,email:persistentUser.email},claveSolicitud:randomUUID()}).expect(201);persistentOrderId=order.body.data.id;
    await db.$disconnect();
    const {PrismaClient}=require('@prisma/client');reopened=new PrismaClient();
    const [storedUser,storedProduct,storedPromotion,storedOrder]=await Promise.all([
      reopened.usuario.findUnique({where:{id:persistentUser.id}}),
      reopened.producto.findUnique({where:{id}}),
      reopened.promocion.findUnique({where:{id:promotionId}}),
      reopened.pedido.findUnique({where:{id:persistentOrderId},include:{detalles:true}}),
    ]);
    assert.equal(storedUser.role,'user');assert.ok(await bcrypt.compare(userInput.password,storedUser.passwordHash));
    assert.equal(storedProduct.nombre,edited.body.data.nombre);assert.equal(Number(storedProduct.precio),4.56);assert.equal(storedProduct.stock,4);
    assert.equal(storedPromotion.titulo,'Campaña persistente editada');assert.equal(storedPromotion.productoId,id);
    assert.equal(storedOrder.userId,persistentUser.id);assert.equal(Number(storedOrder.total),9.12);assert.equal(storedOrder.detalles[0].productoId,id);assert.equal(storedOrder.detalles[0].cantidad,2);assert.equal(Number(storedOrder.detalles[0].precioUnitario),4.56);
    const customerOrders=(await request.get('/api/pedidos/mis-pedidos').set('Authorization',bearer(token)).expect(200)).body.data.items;
    const adminOrders=(await request.get('/api/pedidos').set('Authorization',bearer(adminToken)).expect(200)).body.data.items;
    assert.equal(customerOrders.length,1);assert.equal(customerOrders[0].id,persistentOrderId);assert.ok(adminOrders.some(row=>row.id===persistentOrderId));
    assert.equal((await request.get('/api/productos/'+id).expect(200)).body.data.stock,4);
    assert.ok((await request.get('/api/promociones').expect(200)).body.data.some(row=>row.id===promotionId));
  } finally {
    if(reopened)await reopened.$disconnect();
    if(promotionId)await db.promocion.deleteMany({where:{id:promotionId}});
    if(persistentOrderId){await db.pedidoDetalle.deleteMany({where:{pedidoId:persistentOrderId}});await db.pedido.deleteMany({where:{id:persistentOrderId}});}
    await db.producto.deleteMany({where:{id}});await db.usuario.deleteMany({where:{id:persistentUser.id}});
  }
});
test('seed repetido y adopción de base anterior preservan ediciones, borrados, stock y credenciales sin duplicar',async()=>{
  const {execFileSync}=require('node:child_process');const path=require('node:path');
  const initialProducts=require('../../data/productos.json');const initialPromotions=require('../../data/promociones.json');
  const savedProduct=await db.producto.findUnique({where:{id:initialProducts[0].id}});
  const savedInactive=await db.producto.findUnique({where:{id:initialProducts.at(-1).id}});
  const savedPromotions=await db.promocion.findMany({where:{id:{in:initialPromotions.map(promo=>promo.id)}}});
  const savedAdmin=await db.usuario.findUnique({where:{email:process.env.ADMIN_EMAIL}});
  const counts=async()=>Promise.all([db.usuario.count(),db.producto.count(),db.promocion.count(),db.pedido.count(),db.pedidoDetalle.count(),db.semilla.count()]);
  const runSeed=extra=>execFileSync(process.execPath,['server/prisma/seed.cjs'],{cwd:path.resolve(__dirname,'../..'),stdio:'pipe',env:{...process.env,ADMIN_PASSWORD:'OtraSemilla2026!',...extra}});
  try {
    await request.put('/api/productos/'+savedProduct.id).set('Authorization',bearer(adminToken)).send({...productInput,nombre:'Semilla editada por administrador',precio:12.34,stock:9,esperadoUpdatedAt:savedProduct.updatedAt.toISOString()}).expect(200);
    await request.delete('/api/productos/'+savedInactive.id).set('Authorization',bearer(adminToken)).expect(204);
    const first=savedPromotions[0],removed=savedPromotions[1];
    await request.put('/api/promociones/'+first.id).set('Authorization',bearer(adminToken)).send({titulo:'Campaña inicial editada',descripcion:first.descripcion,etiqueta:first.etiqueta,productoId:first.productoId,activa:false,vistaPrevia:true,orden:99,inicio:null,fin:null}).expect(200);
    await request.delete('/api/promociones/'+removed.id).set('Authorization',bearer(adminToken)).expect(204);
    const changedPasswordHash=await bcrypt.hash('ClaveActualizada2026!',12);
    await db.usuario.update({where:{id:savedAdmin.id},data:{passwordHash:changedPasswordHash}});
    const before=await counts();
    runSeed();runSeed();assert.deepEqual(await counts(),before);
    // A legacy database has records from the old seed but no version marker yet.
    await db.semilla.delete({where:{id:'catalogo-inicial-v1'}});runSeed();
    assert.deepEqual(await counts(),before);
    assert.equal((await db.producto.findUnique({where:{id:savedProduct.id}})).stock,9);
    assert.equal(Number((await db.producto.findUnique({where:{id:savedProduct.id}})).precio),12.34);
    assert.equal((await db.producto.findUnique({where:{id:savedProduct.id}})).nombre,'Semilla editada por administrador');
    assert.equal((await db.producto.findUnique({where:{id:savedInactive.id}})).activo,false);
    assert.equal((await db.producto.findUnique({where:{id:savedInactive.id}})).stock,0);
    assert.equal((await db.promocion.findUnique({where:{id:first.id}})).titulo,'Campaña inicial editada');
    assert.equal((await db.promocion.findUnique({where:{id:first.id}})).activa,false);
    assert.equal(await db.promocion.findUnique({where:{id:removed.id}}),null);
    assert.equal((await db.usuario.findUnique({where:{id:savedAdmin.id}})).passwordHash,changedPasswordHash);
    assert.ok(await db.pedido.findUnique({where:{id:orderId}}));assert.equal((await db.usuario.findUnique({where:{id:userId}})).role,'user');
    assert.throws(()=>runSeed({ADMIN_EMAIL:userInput.email}),/usuario normal/);assert.deepEqual(await counts(),before);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'),[]);
  } finally {
    const {id:productId,...productData}=savedProduct;await db.producto.update({where:{id:productId},data:productData});
    const {id:inactiveId,...inactiveData}=savedInactive;await db.producto.update({where:{id:inactiveId},data:inactiveData});
    for(const promo of savedPromotions){const {id,...data}=promo;await db.promocion.upsert({where:{id},update:data,create:promo});}
    await db.usuario.update({where:{id:savedAdmin.id},data:{passwordHash:savedAdmin.passwordHash}});
  }
});
test('logout revoca tokens ya emitidos y la BD persiste al abrir otro cliente Prisma',async()=>{
  await request.post('/api/auth/logout').set('Authorization',bearer(userToken)).expect(204);
  await request.get('/api/auth/me').set('Authorization',bearer(userToken)).expect(401);
  const {PrismaClient}=require('@prisma/client');const reopened=new PrismaClient();try{assert.ok(await reopened.pedido.findUnique({where:{id:orderId}}));}finally{await reopened.$disconnect();}
});
after(async()=>{await db.$disconnect();const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));await fs.rm(directory,{recursive:true,force:true});});
