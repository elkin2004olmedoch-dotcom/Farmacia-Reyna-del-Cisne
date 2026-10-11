const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const supertest=require('supertest');
const {db}=require('./fixture.cjs');
const createApp=require('../../server/app.cjs');
const settings=require('../../server/config.cjs')();
after(()=>db.$disconnect());
test('aumentar intentos en el servidor temporal del navegador no cambia el límite de producción',async()=>{
  const app=createApp({...settings,production:true,testAuthLimit:200,testApiLimit:2000});const request=supertest(app);
  for(let i=0;i<20;i++)await request.post('/api/auth/login').send({email:'incorrecto',password:'x'}).expect(422);
  const denied=await request.post('/api/auth/login').send({email:'incorrecto',password:'x'}).expect(429);assert.equal(denied.body.error.code,'RATE_LIMIT');
  const fixture=supertest(createApp({...settings,testAuthLimit:200,testApiLimit:2000}));
  for(let i=0;i<21;i++)await fixture.post('/api/auth/login').send({email:'incorrecto',password:'x'}).expect(422);
});
