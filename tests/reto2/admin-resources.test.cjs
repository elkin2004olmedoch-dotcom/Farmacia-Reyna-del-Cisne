const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const {db,request}=require('./fixture.cjs');
const {Prisma}=require('../../backend/models/prisma-client.cjs');
const headers=user=>({Authorization:'Bearer '+jwt.sign({version:user.tokenVersion,epoch:user.tokenEpoch??null},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
const admin=async()=>headers(await db.usuario.findFirst({where:{role:'admin',activo:true}}));
after(()=>db.$disconnect());

test('la asignación única conserva los permisos y cambia por la API administrativa',async()=>{
 const auth=await admin();
 const customer=await db.usuario.create({data:{nombre:'Cliente Roles',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}});
 const before=headers(customer);
 for(const url of ['/api/admin/roles','/api/admin/usuarios-roles']){
  await request.get(url).expect(401);
  await request.get(url).set(before).expect(403);
 }
 const catalog=(await request.get('/api/admin/roles').set(auth).expect(200)).body.data;
 assert.deepEqual(catalog.items.map(item=>item.id),['admin','repartidor','user']);
 const assignment='/api/admin/tablas/usuario-rol/'+customer.id;
 assert.equal((await request.get(assignment).set(auth).expect(200)).body.data.item.rolId,'user');
 await request.patch('/api/admin/usuarios/'+customer.id).set(auth).send({role:'repartidor',esperadoUpdatedAt:customer.updatedAt.toISOString()}).expect(200);
 await request.get('/api/auth/me').set(before).expect(401);
 assert.deepEqual((await request.get(assignment).set(auth).expect(200)).body.data.item,{usuarioId:customer.id,rolId:'repartidor'});
 await assert.rejects(db.usuarioRol.update({where:{usuarioId:customer.id},data:{rolId:'admin'}}));
 await assert.rejects(db.usuarioRol.delete({where:{usuarioId:customer.id}}));
 await db.usuario.delete({where:{id:customer.id}});
 assert.equal(await db.usuarioRol.count({where:{usuarioId:customer.id}}),0);
});

test('los recursos administrativos cubren cada modelo Prisma y exigen administrador',async()=>{
 await request.get('/api/admin/recursos').expect(401);
 const customer=await db.usuario.create({data:{nombre:'Cliente Recursos',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}});
 await request.get('/api/admin/recursos').set(headers(customer)).expect(403);
 const auth=await admin(),resources=(await request.get('/api/admin/recursos').set(auth).expect(200)).body.data;
 assert.deepEqual(resources.map(item=>item.model).sort(),Prisma.dmmf.datamodel.models.map(model=>model.name).sort());
 assert.equal(new Set(resources.map(item=>item.key)).size,resources.length);
 for(const resource of resources){
  assert.equal(typeof resource.label,'string');assert.equal(typeof resource.primaryKey,'string');assert.ok(resource.columns.length>0);assert.equal(resource.readOnly,true);
  assert.ok(resource.columns.every(column=>typeof column.key==='string'&&typeof column.label==='string'));
  const page=(await request.get('/api/admin/tablas').set(auth).query({tabla:resource.key,page:1,pageSize:1}).expect(200)).body.data;
  assert.equal(page.resource.key,resource.key);assert.equal(page.page,1);assert.equal(page.pageSize,1);assert.ok(Array.isArray(page.items));assert.ok(Number.isInteger(page.total));
 }
});

test('las tablas validan claves, escalares, paginación y lecturas individuales',async()=>{
 const auth=await admin();
 for(const suffix of ['tabla=__proto__','tabla=sesiones-web&page=0','tabla=productos&pageSize=101','tabla=productos&page=1&page=2','tabla[]=productos','tabla=productos&select=passwordHash'])await request.get('/api/admin/tablas?'+suffix).set(auth).expect(422);
 await request.get('/api/admin/tablas?tabla=productos').expect(401);
 const alias=(await request.get('/api/admin/tablas?tabla=Producto').set(auth).expect(200)).body.data;assert.equal(alias.resource.key,'productos');
 const single=(await request.get('/api/admin/tablas/semillas/catalogo-inicial-v1').set(auth).expect(200)).body.data;
 assert.equal(single.item.id,'catalogo-inicial-v1');assert.equal(single.resource.primaryKey,'id');
 await request.get('/api/admin/tablas/semillas/no-existe').set(auth).expect(404);
 await request.put('/api/admin/tablas/semillas/catalogo-inicial-v1').set(auth).send({id:'cambio'}).expect(404);
});

test('la proyección técnica excluye secretos, credenciales, documentos y contacto privado',async()=>{
 const auth=await admin(),user=await db.usuario.create({data:{nombre:'Cuenta privada',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'SYNTHETIC-PRIVATE'}});
 const expiresAt=new Date(Date.now()+3600000);
 await db.emailVerification.create({data:{usuarioId:user.id,email:user.email,tokenHash:'a'.repeat(64),expiresAt}});
 await db.passwordReset.create({data:{usuarioId:user.id,email:user.email,tokenHash:'b'.repeat(64),expiresAt}});
 await db.adminMfa.create({data:{usuarioId:user.id,secretCipher:'SYNTHETIC-PRIVATE'}});
 await db.sesionWeb.create({data:{usuarioId:user.id,tokenVersion:0,secretHash:'c'.repeat(64),expiresAt}});
 await db.registroPendiente.create({data:{usuarioId:user.id,email:user.email,secretHash:'d'.repeat(64),tokenVersion:0,expiresAt}});
 const resources=(await request.get('/api/admin/recursos').set(auth).expect(200)).body.data;
 for(const resource of resources){
  const page=(await request.get('/api/admin/tablas').set(auth).query({tabla:resource.key}).expect(200)).body.data;
  const serialized=JSON.stringify(page);
  assert.doesNotMatch(serialized,/"(?:passwordHash|tokenHash|secretHash|previousSecretHash|secretCipher|recoveryHashes|hash|tokenEpoch|snapshot|xmlBorrador|xmlFirmado|xmlAutorizado|certificadoCifrado|codigoEntregaNonce|challengeHash|fingerprint|requestKey)"/);
  assert.ok(!serialized.includes('SYNTHETIC-PRIVATE'));assert.ok(!serialized.includes(user.email));
 }
 const users=(await request.get('/api/admin/tablas?tabla=usuarios').set(auth).expect(200)).body.data;
 assert.ok(users.items.every(item=>!Object.hasOwn(item,'email')&&!Object.hasOwn(item,'telefono')));
});

test('los movimientos conservan loteId en el DTO y el hijo normalizado usa su clave real',async()=>{
 const actor=await db.usuario.findFirst({where:{role:'admin',activo:true}}),auth=headers(actor),product=await db.producto.findFirst();
 const lot=await db.lote.create({data:{productoId:product.id,numero:'ADMIN-'+randomUUID().slice(0,8),vencimiento:'2035-01-01',stock:0,costoUnitario:1}});
 const movement=await db.movimientoInventario.create({data:{productoId:product.id,actorId:actor.id,tipo:'entrada',cantidad:1,motivo:'Prueba de lectura administrativa',movimientoLote:{create:{loteId:lot.id}}}});
 const dto=(await request.get('/api/admin/tablas/movimientos/'+movement.id).set(auth).expect(200)).body.data.item;
 assert.equal(dto.loteId,lot.id);assert.equal(dto.lote.id,lot.id);assert.equal(dto.actor.id,actor.id);assert.equal(dto.actor.email,undefined);assert.equal(dto.movimientoLote,undefined);
 const link=(await request.get('/api/admin/tablas/movimiento-lotes/'+movement.id).set(auth).expect(200)).body.data;
 assert.equal(link.resource.primaryKey,'movimientoId');assert.deepEqual(link.item,{movimientoId:movement.id,loteId:lot.id});
});

test('la tabla de pedidos conserva los datos necesarios de entrega y omite claves internas',async()=>{
 const user=await db.usuario.create({data:{nombre:'Comprador administrativo',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}}),auth=await admin();
 const order=await db.pedido.create({data:{userId:user.id,total:0,entrega:'pickup',nombre:'Destinatario sintético',email:'pedido-sintetico@example.ec',telefono:'+593991234567',documento:'••••••0400',provincia:'Pichincha',ciudad:'Puerto Quito',direccion:'Avenida sintética 123',codigoPostal:'170950',requestKey:randomUUID(),fingerprint:'PRIVATE-ORDER-KEY'}});
 const item=(await request.get('/api/admin/tablas/pedidos/'+order.id).set(auth).expect(200)).body.data.item;
 for(const field of ['nombre','email','telefono','documento','provincia','ciudad','direccion','codigoPostal'])assert.equal(item[field],order[field],field);
 assert.equal(item.requestKey,undefined);assert.equal(item.fingerprint,undefined);assert.equal(item.latitudEntrega,undefined);assert.equal(item.longitudEntrega,undefined);
});
