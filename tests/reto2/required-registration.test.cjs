'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const request=require('supertest'),mail=require('../../server/models/email-delivery.cjs');
const {db}=require('./fixture.cjs');
const createApp=require('../../server/app.cjs'),base=require('../../server/config.cjs')();
const values={nombre:'Cliente Obligatorio',email:'obligatorio@example.ec',telefono:'0991234567',cedula:'0102030400',password:'VerificarPrimero2026!'};
const original=mail.sendVerification;
after(async()=>{mail.sendVerification=original;await db.$disconnect();});
test('registro obligatorio sin servicio devuelve 503 y no crea usuario ni JWT',async()=>{
 const api=request(createApp({...base,requireVerifiedRegistration:true,emailVerification:{enabled:false}}));const result=await api.post('/api/auth/register').send(values).expect(503);assert.equal(result.body.error.code,'EMAIL_UNAVAILABLE');assert.equal(await db.usuario.count({where:{email:values.email}}),0);assert.ok(!result.body.data?.token);
});
test('registro con servicio crea pendiente, envía enlace y exige confirmación antes del login',async()=>{
 const messages=[];mail.sendVerification=async message=>{messages.push(message);return {accepted:true};};
 const config={...base,requireVerifiedRegistration:true,emailVerification:{enabled:true,provider:'brevo',publicOrigin:'http://localhost:3000',from:'farmacia@example.ec',apiKey:'xkeysib-synthetic_not_real_1234567890123456'}};
 const api=request(createApp(config)),created=await api.post('/api/auth/register').send(values).expect(202);assert.equal(created.body.data.requiresEmailVerification,true);assert.equal(created.body.data.deliveryStatus,'sent');assert.ok(!created.body.data.token);const user=await db.usuario.findUnique({where:{email:values.email}});assert.equal(user.emailVerificationRequired,true);assert.equal(user.emailVerifiedAt,null);const row=await db.emailVerification.findUnique({where:{usuarioId:user.id}});assert.equal(messages[0].expiresAt.getTime(),row.expiresAt.getTime());await api.post('/api/auth/login').send({email:values.email,password:values.password}).expect(403);await api.post('/api/auth/verify-email').send({token:messages[0].token}).expect(200);await api.post('/api/auth/login').send({email:values.email,password:values.password}).expect(200);
 const legacy=await db.usuario.create({data:{nombre:'Cliente Anterior',email:'anterior@example.ec',telefono:values.telefono,passwordHash:user.passwordHash,role:'user',emailVerificationRequired:false}});await api.post('/api/auth/login').send({email:legacy.email,password:values.password}).expect(403);await api.post('/api/auth/resend-verification').send({email:legacy.email}).expect(202);assert.equal((await db.usuario.findUnique({where:{id:legacy.id}})).emailVerificationRequired,true);await api.post('/api/auth/verify-email').send({token:messages[1].token}).expect(200);await api.post('/api/auth/login').send({email:legacy.email,password:values.password}).expect(200);
});
