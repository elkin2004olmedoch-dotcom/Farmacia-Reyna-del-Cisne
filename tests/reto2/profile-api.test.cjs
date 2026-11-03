'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken'),bcrypt=require('bcrypt');
const {request,db}=require('./fixture.cjs');
const hash=bcrypt.hashSync('PerfilPrueba2026!',12);
const sign=user=>jwt.sign({version:user.tokenVersion},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'});
let sequence=0;
async function user(role='user',extra={}){return db.usuario.create({data:{nombre:'Perfil Original',email:`perfil-${++sequence}@example.ec`,telefono:'+593979275988',passwordHash:hash,role,...extra}});}
const values={nombre:'Ana Pérez',telefono:'0991234567'};
after(async()=>{await db.$disconnect();});
test('perfil requiere sesión válida',async()=>{await request.put('/api/auth/me').send(values).expect(401);await request.put('/api/auth/me').set('Authorization','Bearer inválido').send(values).expect(401);});
for(const role of ['user','admin','repartidor'])test(`perfil propio de ${role}: guarda sólo nombre y teléfono y conserva acceso`,async()=>{
 const original=await user(role,{emailVerifiedAt:new Date()}),token=sign(original),headers={Authorization:'Bearer '+token};
 const result=await request.put('/api/auth/me').set(headers).send(values).expect(200);assert.equal(result.body.data.nombre,values.nombre);assert.equal(result.body.data.telefono,'+593991234567');assert.equal(result.body.data.id,original.id);assert.equal(result.body.data.role,role);assert.ok(!JSON.stringify(result.body).includes('passwordHash'));assert.ok(!JSON.stringify(result.body).includes('tokenVersion'));
 const saved=await db.usuario.findUnique({where:{id:original.id}});for(const key of ['id','email','passwordHash','role','tokenVersion','activo'])assert.equal(saved[key],original[key]);assert.equal(saved.emailVerifiedAt.getTime(),original.emailVerifiedAt.getTime());await request.get('/api/auth/me').set(headers).expect(200);
});
test('rechaza campos ajenos, privilegios y cambio de destinatario sin modificar a ningún usuario',async()=>{
 const alice=await user(),bob=await user(),headers={Authorization:'Bearer '+sign(alice)};
 for(const patch of [{id:bob.id},{userId:bob.id},{email:'ajeno@example.ec'},{role:'admin'},{password:'OtroPassword123!'},{passwordHash:'hash'},{activo:false},{emailVerifiedAt:new Date().toISOString()},{emailVerificationRequired:false},{tokenVersion:100}])await request.put('/api/auth/me').set(headers).send({...values,...patch}).expect(422);
 const saved=await db.usuario.findUnique({where:{id:alice.id}});assert.equal(saved.nombre,alice.nombre);assert.equal((await db.usuario.findUnique({where:{id:bob.id}})).nombre,bob.nombre);
});
test('validación y sanitización de perfil no admiten entradas inválidas',async()=>{
 const original=await user(),headers={Authorization:'Bearer '+sign(original)};
 for(const body of [{},[],{nombre:'A',telefono:'123'},{nombre:'Ana',telefono:null},{nombre:'<script></script>',telefono:values.telefono},{nombre:'A'.repeat(81),telefono:values.telefono},{nombre:12,telefono:values.telefono}])await request.put('/api/auth/me').set(headers).send(body).expect(422);
 const safe=await request.put('/api/auth/me').set(headers).send({nombre:' <b>Ana Pérez</b> ',telefono:'0991234567'}).expect(200);assert.equal(safe.body.data.nombre,'Ana Pérez');assert.ok(!JSON.stringify(safe.body).includes('<b>'));
});
test('cuentas inactivas, revocadas o pendientes no pueden cambiar el perfil',async()=>{
 for(const extra of [{activo:false},{tokenVersion:2},{emailVerificationRequired:true,emailVerifiedAt:null}]){const record=await user('user',extra),token=sign({...record,tokenVersion:0});await request.put('/api/auth/me').set('Authorization','Bearer '+token).send(values).expect(extra.emailVerificationRequired?403:401);assert.equal((await db.usuario.findUnique({where:{id:record.id}})).nombre,record.nombre);}
});
test('sesión móvil del repartidor permite editar sus datos sin revocar el seguimiento',async()=>{
 const record=await user('repartidor'),login=await request.post('/api/auth/mobile/login').send({email:record.email,password:'PerfilPrueba2026!'}).expect(200),token=login.body.data.token;
 await request.put('/api/auth/me').set('Authorization','Bearer '+token).send(values).expect(200);await request.get('/api/auth/me').set('Authorization','Bearer '+token).expect(200);const session=await db.sesionMovil.findFirst({where:{usuarioId:record.id}});assert.equal(session.revokedAt,null);
});
