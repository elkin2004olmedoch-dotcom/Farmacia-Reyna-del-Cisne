'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const {request,db}=require('./fixture.cjs');
let sequence=0;
async function user(role='user'){return db.usuario.create({data:{nombre:'Ana Pérez',email:`cuenta-${++sequence}@example.ec`,telefono:'+593991234567',passwordHash:'synthetic-hash',role}});}
const headers=u=>({Authorization:'Bearer '+jwt.sign({version:u.tokenVersion},process.env.JWT_SECRET,{subject:u.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
const address={alias:'Casa',provincia:'Pichincha',ciudad:'Puerto Quito',direccion:'Calle principal s/n frente al parque',codigoPostal:'170950'};
after(()=>db.$disconnect());
test('direcciones: lista privada, propiedad, validación, límite y edición concurrente',async()=>{
 const a=await user(),b=await user();
 const first=await request.get('/api/cuenta/direcciones').set(headers(a)).expect(200);assert.deepEqual(first.body.data,[]);assert.match(first.headers['cache-control'],/no-store/);
 await request.get('/api/cuenta/direcciones').expect(401);for(const role of ['admin','repartidor'])await request.get('/api/cuenta/direcciones').set(headers(await user(role))).expect(403);
 for(const patch of [{provincia:'España'},{codigoPostal:'090101'},{userId:b.id},{direccion:'<script>x</script>'},{ciudad:5}])await request.post('/api/cuenta/direcciones').set(headers(a)).send({...address,...patch}).expect(422);
 const saved=(await request.post('/api/cuenta/direcciones').set(headers(a)).send(address).expect(201)).body.data;
 assert.ok(!Object.hasOwn(saved,'userId'));
 await request.put('/api/cuenta/direcciones/'+saved.id).set(headers(b)).send({...address,esperadoUpdatedAt:saved.updatedAt}).expect(404);
 await request.delete('/api/cuenta/direcciones/'+saved.id).set(headers(b)).expect(404);
 const edited=(await request.put('/api/cuenta/direcciones/'+saved.id).set(headers(a)).send({...address,alias:'Trabajo',esperadoUpdatedAt:saved.updatedAt}).expect(200)).body.data;
 await request.put('/api/cuenta/direcciones/'+saved.id).set(headers(a)).send({...address,esperadoUpdatedAt:saved.updatedAt}).expect(409);assert.notEqual(edited.updatedAt,saved.updatedAt);
 for(let n=1;n<10;n++)await request.post('/api/cuenta/direcciones').set(headers(a)).send({...address,alias:'Casa '+n}).expect(201);
 await request.post('/api/cuenta/direcciones').set(headers(a)).send(address).expect(409);
 await request.delete('/api/cuenta/direcciones/'+saved.id).set(headers(a)).expect(204);
});
test('favoritos: idempotentes, propios y sin campos extra',async()=>{
 const a=await user(),b=await user(),p=await db.producto.findFirst({where:{activo:true}});
 await request.put('/api/cuenta/favoritos/'+p.id).set(headers(a)).send({userId:b.id}).expect(422);
 for(let n=0;n<2;n++)await request.put('/api/cuenta/favoritos/'+p.id).set(headers(a)).send({}).expect(200);
 assert.equal((await request.get('/api/cuenta/favoritos').set(headers(a)).expect(200)).body.data.length,1);
 assert.deepEqual((await request.get('/api/cuenta/favoritos').set(headers(b)).expect(200)).body.data,[]);
 await request.delete('/api/cuenta/favoritos/'+p.id).set(headers(b)).expect(204);
 assert.equal(await db.favorito.count({where:{userId:a.id}}),1);
 await request.delete('/api/cuenta/favoritos/'+p.id).set(headers(a)).expect(204);
});
test('dos altas simultáneas no exceden diez direcciones',async()=>{
 const a=await user();
 for(let n=0;n<9;n++)await request.post('/api/cuenta/direcciones').set(headers(a)).send({...address,alias:'Casa '+n}).expect(201);
 const responses=await Promise.all([0,1].map(()=>request.post('/api/cuenta/direcciones').set(headers(a)).send(address)));
 assert.deepEqual(responses.map(response=>response.status).sort(),[201,409]);assert.equal(await db.direccionGuardada.count({where:{userId:a.id}}),10);
});
test('sesión cookie protege mutaciones de cuenta con CSRF existente',async()=>{
 const a=await user(),web={'X-Farmacia-Web':'1',Origin:'http://localhost:3000'};
 const exchanged=await request.post('/api/auth/web/exchange').set({...headers(a),...web}).send({}).expect(200),cookie=exchanged.headers['set-cookie'].map(value=>value.split(';')[0]).join('; ');
 await request.get('/api/cuenta/direcciones').set('Cookie',cookie).expect(200);
 await request.post('/api/cuenta/direcciones').set('Cookie',cookie).send(address).expect(403);
 await request.post('/api/cuenta/direcciones').set({...web,Origin:'https://evil.example'}).set('Cookie',cookie).send(address).expect(403);
 await request.post('/api/cuenta/direcciones').set(web).set('Cookie',cookie).send(address).expect(201);
});
test('alias de dirección limita a cuarenta caracteres en alta, edición e interfaz',async()=>{
 const a=await user(),validAlias='A'.repeat(40),invalidAlias='A'.repeat(41);
 await request.post('/api/cuenta/direcciones').set(headers(a)).send({...address,alias:invalidAlias}).expect(422);
 assert.equal(await db.direccionGuardada.count({where:{userId:a.id}}),0);
 const saved=(await request.post('/api/cuenta/direcciones').set(headers(a)).send({...address,alias:validAlias}).expect(201)).body.data;
 await request.put('/api/cuenta/direcciones/'+saved.id).set(headers(a)).send({...address,alias:invalidAlias,esperadoUpdatedAt:saved.updatedAt}).expect(422);
 assert.equal((await db.direccionGuardada.findUnique({where:{id:saved.id}})).alias,validAlias);
 const {accountPanels}=await import('../../frontend/views/customer-account.js');let markup='';accountPanels({insertAdjacentHTML(position,html){markup=html;}});
 assert.match(markup,/<input[^>]*id="saved-alias"[^>]*maxlength="40"/);
});
