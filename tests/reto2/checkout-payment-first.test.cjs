const {test,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const fixture=require('./email-api-fixture.cjs').createFixture(),{db}=fixture,api=fixture.api(false);
let user,product;const headers=()=>({Authorization:'Bearer '+user.token});
const buyer={name:'Cliente Pago',email:'checkout-pago@example.ec',phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:'pickup'};
const payload=()=>({carrito:[{productoId:product.id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()});
after(async()=>{delete process.env.PAYMENT_PRACTICE_ENABLED;await fixture.close();});
test('no crea pedidos, movimientos ni comprobantes antes de completar el pago',async()=>{
 user=(await api.post('/api/auth/register').send({nombre:buyer.name,email:buyer.email,telefono:buyer.phone,cedula:buyer.document,password:'PagoPrimero2026!'}).expect(201)).body.data;
 product=await db.producto.create({data:{nombre:'Cuidado Pago',precio:5,stock:20,categoria:'cuidado',descripcion:'Producto sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});
 process.env.PAYMENT_PRACTICE_ENABLED='true';const before=await db.pedido.count();
 const missing=await api.post('/api/pedidos').set(headers()).send(payload()).expect(409);assert.equal(missing.body.error.code,'CHECKOUT_PAYMENT_REQUIRED');
 assert.equal(await db.pedido.count(),before);assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,20);
});
test('pago y pedido se guardan juntos; reintentar no cobra ni reserva dos veces',async()=>{
 const input={...payload(),pago:{metodo:'card',marca:'visa'},esperadoTotalCentavos:500};
 const created=(await api.post('/api/pedidos').set(headers()).send(input).expect(201)).body.data;
 assert.equal(created.pagoPractica.metodo,'card');assert.equal(created.pagoPractica.totalCentavos,500);assert.equal(Number(created.total),5);
 const retry=(await api.post('/api/pedidos').set(headers()).send(input).expect(200)).body.data;assert.equal(retry.id,created.id);assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,19);
 await api.post('/api/pedidos').set(headers()).send({...input,pago:{metodo:'transfer'}}).expect(409);
});
test('rechaza precio cambiado y datos bancarios inesperados sin persistencia parcial',async()=>{
 const count=await db.pedido.count(),stock=(await db.producto.findUnique({where:{id:product.id}})).stock;
 for(const extra of [{pago:{metodo:'card',marca:'visa'},esperadoTotalCentavos:1},{pago:{metodo:'card',marca:'visa',cvv:'123'},esperadoTotalCentavos:500},{pago:{metodo:'manual'},esperadoTotalCentavos:500}]){
  const res=await api.post('/api/pedidos').set(headers()).send({...payload(),...extra});assert.ok([409,422].includes(res.status));
 }
 assert.equal(await db.pedido.count(),count);assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,stock);
});
test('listado de usuarios excluye correos y teléfono; perfil propio conserva datos necesarios',async()=>{
 const admin=(await api.post('/api/auth/login').send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200)).body.data;
 const res=await api.get('/api/admin/tablas?tabla=usuarios&page=1&pageSize=20').set('Authorization','Bearer '+admin.token).expect(200);
 for(const item of res.body.data.items){assert.equal(item.email,undefined);assert.equal(item.telefono,undefined);}
 assert.equal((await api.get('/api/auth/me').set(headers()).expect(200)).body.data.email,buyer.email);
});
