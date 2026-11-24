const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const bcrypt=require('bcrypt'),jwt=require('jsonwebtoken');
const {db,request}=require('./fixture.cjs');
const headers=user=>({Authorization:'Bearer '+jwt.sign({version:user.tokenVersion,epoch:user.tokenEpoch??null},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
const staff=async()=>headers(await db.usuario.findFirst({where:{role:'admin',activo:true}}));
const input=patch=>({nombre:'Usuario Administrativo',username:'usuario-'+randomUUID().slice(0,8),email:randomUUID()+'@example.ec',telefono:'0991234567',password:'UsuarioSeguro2026!',role:'user',activo:true,...patch});
after(()=>db.$disconnect());

test('crear y leer usuarios exige admin y devuelve campos seguros con contraseña hasheada',async()=>{
 const body=input();await request.post('/api/admin/usuarios').send(body).expect(401);
 const customer=await db.usuario.create({data:{nombre:'Cliente',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}});
 await request.post('/api/admin/usuarios').set(headers(customer)).send(body).expect(403);
 const auth=await staff();
 for(const patch of [{role:'root'},{activo:'true'},{username:'../admin'},{password:'corta'},{passwordHash:'overpost'},{tokenVersion:40}])await request.post('/api/admin/usuarios').set(auth).send({...body,...patch}).expect(422);
 const created=(await request.post('/api/admin/usuarios').set(auth).send({...body,username:' '+body.username.toUpperCase()+' '}).expect(201)).body.data;
 assert.equal(created.username,body.username);assert.equal(created.telefono,'+593991234567');assert.ok(created.updatedAt);assert.equal(created.passwordHash,undefined);assert.equal(created.tokenVersion,undefined);
 const stored=await db.usuario.findUnique({where:{id:created.id}});assert.ok(await bcrypt.compare(body.password,stored.passwordHash));assert.notEqual(stored.passwordHash,body.password);
 const found=(await request.get('/api/admin/usuarios/'+created.id).set(auth).expect(200)).body.data;assert.equal(found.email,body.email);
 await request.get('/api/admin/usuarios/'+created.id).set(headers(customer)).expect(403);
 await request.post('/api/admin/usuarios').set(auth).send(input({username:body.username})).expect(409);
});

test('PUT y PATCH conservan campos omitidos, exigen CAS y revocan sesiones en cambios de acceso',async()=>{
 const auth=await staff(),body=input();
 const created=(await request.post('/api/admin/usuarios').set(auth).send(body).expect(201)).body.data,url='/api/admin/usuarios/'+created.id;
 const current=await db.usuario.findUnique({where:{id:created.id}}),oldAccess=headers(current);
 const session=await db.sesionWeb.create({data:{usuarioId:created.id,tokenVersion:current.tokenVersion,secretHash:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000)}});
 await request.patch(url).set(auth).send({nombre:'Sin versión'}).expect(422);
 await request.patch(url).set(auth).send({tokenVersion:5,esperadoUpdatedAt:created.updatedAt}).expect(422);
 const updated=(await request.patch(url).set(auth).send({nombre:'Nombre editado',esperadoUpdatedAt:created.updatedAt}).expect(200)).body.data;
 assert.equal(updated.email,body.email);assert.equal(updated.username,body.username);
 await request.get('/api/auth/me').set(oldAccess).expect(200);
 const {password,...full}=body;
 const changed=(await request.put(url).set(auth).send({...full,nombre:'Nombre completo',role:'admin',esperadoUpdatedAt:updated.updatedAt}).expect(200)).body.data;
 assert.equal(changed.role,'admin');assert.equal(await bcrypt.compare(password,(await db.usuario.findUnique({where:{id:created.id}})).passwordHash),true);
 await request.get('/api/auth/me').set(oldAccess).expect(401);
 assert.ok((await db.sesionWeb.findUnique({where:{id:session.id}})).revokedAt);
 await request.patch(url).set(auth).send({activo:false,esperadoUpdatedAt:updated.updatedAt}).expect(409);
 const attempts=await Promise.all(['Cambio Uno','Cambio Dos'].map(nombre=>request.patch(url).set(auth).send({nombre,esperadoUpdatedAt:changed.updatedAt})));
 assert.deepEqual(attempts.map(response=>response.status).sort(),[200,409]);
 const saved=attempts.find(response=>response.status===200).body.data;
 await request.delete(url).set(auth).send({esperadoUpdatedAt:saved.updatedAt}).expect(204);
 const retired=await db.usuario.findUnique({where:{id:created.id}});assert.equal(retired.activo,false);assert.equal(retired.role,'admin');
 assert.ok(await db.auditoriaAdmin.findFirst({where:{actorId:{not:created.id},accion:'user.deactivate'}}));
});

test('dos administradores no pueden desactivar concurrentemente al último administrador activo',async()=>{
 const first=await db.usuario.findFirst({where:{role:'admin',activo:true}}),second=await db.usuario.create({data:{nombre:'Segundo Admin',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic',role:'admin'}});
 const only=await db.usuario.findMany({where:{role:'admin',activo:true}});assert.equal(only.length,2);
 const outcomes=await Promise.all([first,second].map(user=>request.delete('/api/admin/usuarios/'+user.id).set(headers(user)).send({esperadoUpdatedAt:user.updatedAt.toISOString()})));
 assert.deepEqual(outcomes.map(response=>response.status).sort(),[204,409]);
 const last=await db.usuario.findFirst({where:{role:'admin',activo:true}});assert.ok(last);
 const denied=await request.patch('/api/admin/usuarios/'+last.id).set(headers(last)).send({role:'user',esperadoUpdatedAt:last.updatedAt.toISOString()}).expect(409);
 assert.equal(denied.body.error.code,'LAST_ADMIN');assert.equal(await db.usuario.count({where:{role:'admin',activo:true}}),1);
});

test('cambiar contraseña revoca capacidades previas y conserva la actualización atómica',async()=>{
 const auth=await staff(),body=input(),created=(await request.post('/api/admin/usuarios').set(auth).send(body).expect(201)).body.data;
 const url='/api/admin/usuarios/'+created.id,current=await db.usuario.findUnique({where:{id:created.id}}),expiresAt=new Date(Date.now()+3600000);
 await db.passwordReset.create({data:{usuarioId:created.id,email:body.email,tokenHash:'a'.repeat(64),expiresAt}});
 await db.registroPendiente.create({data:{usuarioId:created.id,email:body.email,secretHash:'b'.repeat(64),tokenVersion:current.tokenVersion,expiresAt}});
 const web=await db.sesionWeb.create({data:{usuarioId:created.id,tokenVersion:current.tokenVersion,secretHash:'c'.repeat(64),expiresAt}});
 await request.patch(url).set(auth).send({password:'NuevaContraseña2026!',esperadoUpdatedAt:created.updatedAt}).expect(200);
 const saved=await db.usuario.findUnique({where:{id:created.id}});
 assert.ok(await bcrypt.compare('NuevaContraseña2026!',saved.passwordHash));assert.equal(saved.tokenVersion,current.tokenVersion+1);
 assert.equal(await db.passwordReset.count({where:{usuarioId:created.id}}),0);assert.equal(await db.registroPendiente.count({where:{usuarioId:created.id}}),0);assert.ok((await db.sesionWeb.findUnique({where:{id:web.id}})).revokedAt);
 await request.get('/api/auth/me').set(headers(current)).expect(401);
});

test('retirar rol de repartidor respeta entregas en curso y revoca seguimiento sin cambios parciales',async()=>{
 const auth=await staff(),courier=await db.usuario.create({data:{nombre:'Repartidor editable',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic',role:'repartidor'}});
 const buyer=await db.usuario.findFirst({where:{role:'user'}}),url='/api/admin/usuarios/'+courier.id;
 const order=await db.pedido.create({data:{userId:buyer.id,total:0,estado:'preparado',entrega:'delivery',nombre:'Destino sintético',email:buyer.email,telefono:'+593991234567',documento:'••••••0400',provincia:'Pichincha',ciudad:'Puerto Quito',direccion:'Avenida de prueba 123',requestKey:randomUUID(),fingerprint:'synthetic'}});
 const mobile=await db.sesionMovil.create({data:{usuarioId:courier.id,tokenVersion:courier.tokenVersion,secretHash:'d'.repeat(64),expiresAt:new Date(Date.now()+3600000)}});
 const delivery=await db.entrega.create({data:{pedidoId:order.id,repartidorId:courier.id,estado:'en_camino',sesionSeguimientoId:mobile.id,latitud:.12,longitud:-79.1,precision:6,registradaAt:new Date(),recibidaAt:new Date(),codigoEntregaRequerido:true,codigoEntregaNonce:'e'.repeat(64)}});
 const rejected=await request.patch(url).set(auth).send({role:'user',esperadoUpdatedAt:courier.updatedAt.toISOString()}).expect(409);
 assert.equal(rejected.body.error.code,'DRIVER_HAS_ACTIVE_DELIVERY');assert.equal((await db.usuario.findUnique({where:{id:courier.id}})).role,'repartidor');assert.equal((await db.sesionMovil.findUnique({where:{id:mobile.id}})).revokedAt,null);assert.equal((await db.entrega.findUnique({where:{id:delivery.id}})).repartidorId,courier.id);
 await db.entrega.update({where:{id:delivery.id},data:{estado:'asignada',latitud:null,longitud:null,precision:null,registradaAt:null,recibidaAt:null}});
 await request.patch(url).set(auth).send({role:'user',esperadoUpdatedAt:courier.updatedAt.toISOString()}).expect(200);
 const retired=await db.entrega.findUnique({where:{id:delivery.id}});
 for(const field of ['repartidorId','sesionSeguimientoId','latitud','longitud','registradaAt','recibidaAt','codigoEntregaNonce'])assert.equal(retired[field],null,field);
 assert.equal(retired.version,delivery.version+1);assert.ok(retired.gpsVersion>delivery.gpsVersion);assert.ok((await db.sesionMovil.findUnique({where:{id:mobile.id}})).revokedAt);
});
