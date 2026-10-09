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
test('CORS exacto, JSON incorrecto, tamaño y errores no filtran stacktraces',async()=>{
  const allowed=await request.get('/api/productos').set('Origin','http://localhost:3000').expect(200);assert.equal(allowed.headers['access-control-allow-origin'],'http://localhost:3000');assert.equal(allowed.headers['cache-control'],'no-store');
  const denied=await request.get('/api/productos').set('Origin','https://evil.example').expect(403);assert.ok(!denied.headers['access-control-allow-origin']);
  const invalid=await request.post('/api/auth/login').set('Content-Type','application/json').send('{broken').expect(400);assert.equal(invalid.body.ok,false);assert.ok(!JSON.stringify(invalid.body).includes('stack'));
  await request.post('/api/auth/login').send({email:'x'.repeat(40000),password:'x'}).expect(413);
  await request.get('/api/desconocido').expect(404);assert.ok(allowed.headers['content-security-policy']);assert.ok(!allowed.headers['x-powered-by']);
});
test('logout revoca tokens ya emitidos y la BD persiste al abrir otro cliente Prisma',async()=>{
  await request.post('/api/auth/logout').set('Authorization',bearer(userToken)).expect(204);
  await request.get('/api/auth/me').set('Authorization',bearer(userToken)).expect(401);
  const {PrismaClient}=require('@prisma/client');const reopened=new PrismaClient();try{assert.ok(await reopened.pedido.findUnique({where:{id:orderId}}));}finally{await reopened.$disconnect();}
});
after(async()=>{await db.$disconnect();const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));await fs.rm(directory,{recursive:true,force:true});});
