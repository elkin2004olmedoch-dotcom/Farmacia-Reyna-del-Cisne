const {test,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createFixture}=require('./email-api-fixture.cjs'),fixture=createFixture(),{db}=fixture,api=fixture.api(false);
after(()=>fixture.close());
test('una sesión revocada antes del commit no puede crear pedidos ni registrar pagos',async()=>{
 const registered=(await api.post('/api/auth/register').send({nombre:'Cliente Sesión',email:'session-checkout@example.ec',telefono:'0991234567',cedula:'0102030400',password:'CheckoutSession2026!'}).expect(201)).body.data;
 const actor=await db.usuario.findUnique({where:{id:registered.usuario.id}}),sessions=require('../../server/models/sesiones-web.cjs');
 const {row}=await sessions.create(actor);actor.webSession=row.id;
 const product=await db.producto.findFirst(),orders=require('../../server/models/pedidos.cjs'),payments=require('../../server/models/pagos.cjs');
 const body={carrito:[{productoId:product.id,cantidad:1}],comprador:{name:actor.nombre,email:actor.email,phone:'0991234567',document:'0102030400',delivery:'pickup'},claveSolicitud:randomUUID()};
 const created=await orders.create(actor.id,body,{actor}),count=await db.pedido.count();
 await db.sesionWeb.update({where:{id:row.id},data:{revokedAt:new Date()}});
 await assert.rejects(orders.create(actor.id,{...body,claveSolicitud:randomUUID()},{actor}),error=>error.code==='INVALID_TOKEN');
 process.env.PAYMENT_PRACTICE_ENABLED='true';
 try{await assert.rejects(payments.practice(created.pedido.id,actor,{metodo:'transfer'}),error=>error.code==='INVALID_TOKEN');}
 finally{process.env.PAYMENT_PRACTICE_ENABLED='false';}
 assert.equal(await db.pedido.count(),count);assert.equal(await db.pagoPractica.count(),0);
});
test('un rol o versión antiguos no autorizan acceso al pago',async()=>{
 const actor=await db.usuario.findFirst({where:{email:'session-checkout@example.ec'}}),order=await db.pedido.findFirst({where:{userId:actor.id}}),payments=require('../../server/models/pagos.cjs');
 await assert.rejects(payments.find(order.id,{...actor,role:'admin'}),error=>error.code==='INVALID_TOKEN');
 await db.usuario.update({where:{id:actor.id},data:{tokenVersion:{increment:1}}});
 await assert.rejects(payments.find(order.id,actor),error=>error.code==='INVALID_TOKEN');
});
