'use strict';
const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createFixture}=require('./email-api-fixture.cjs'),{brands,detectBrand}=require('../../frontend/models/card-policy.js');
let fixture,api,users;const originalFetch=globalThis.fetch;
before(async()=>{fixture=createFixture();api=fixture.api(false);globalThis.fetch=()=>{throw new Error('La práctica no usa servicios externos.');};users=[];for(let index=0;index<2;index++){const values={nombre:'Cliente Práctica',email:'practice-'+randomUUID()+'@example.ec',telefono:'0991234567',cedula:'0102030400',password:'PracticePayment2026!'};users.push((await api.post('/api/auth/register').send(values).expect(201)).body.data);}});
after(async()=>{globalThis.fetch=originalFetch;delete process.env.PAYMENT_PRACTICE_ENABLED;await fixture?.close();});
beforeEach(()=>{process.env.PAYMENT_PRACTICE_ENABLED='false';process.env.PAYPHONE_ENABLED='false';});
const headers=(user=users[0])=>({Authorization:'Bearer '+user.token});
async function order(){
 const product=await fixture.db.producto.findFirst();assert.ok(product);
 assert.ok(await fixture.db.usuario.findUnique({where:{id:users[0].usuario.id}}),'La cuenta de la fixture debe existir.');
 return fixture.db.pedido.create({data:{userId:users[0].usuario.id,total:11.5,subtotalProductos:11.5,baseImponible:10,ivaMonto:1.5,estado:'pendiente',entrega:'pickup',nombre:'Cliente Práctica',email:users[0].usuario.email,telefono:'0991234567',documento:'••••••0400',requestKey:randomUUID(),fingerprint:'synthetic-practice',detalles:{create:{productoId:product.id,nombreProducto:'Producto sintético',cantidad:1,precioUnitario:11.5,totalLinea:11.5,ivaPorcentaje:15,baseImponible:10,ivaMonto:1.5}}}});
}
const post=(id,input,user)=>api.post('/api/pedidos/'+id+'/pago/practica').set(headers(user)).send(input);

test('reconoce marcas y longitudes con números inventados, sin validar emisores ni usar Luhn',()=>{
 for(const [number,brand]of [['4111111111111234','visa'],['5100000000001234','mastercard'],['2221000000001234','mastercard'],['2720000000001234','mastercard'],['340000000001234','amex'],['36000000001234','diners'],['6011000000001234','discover'],['6221260000001234','discover']])assert.equal(detectBrand(number),brand);
 for(const value of [null,{},'4','411111111111abcd','1234567890123456','2220000000001234','2721000000001234','<script>4111111111111111</script>'])assert.equal(detectBrand(value),null);
 assert.equal(detectBrand('4111 1111 1111 1234'),'visa');assert.equal(Object.keys(brands).length,5);
});
test('exige dueño autenticado y bandera explícita antes de permitir la práctica',async()=>{
 const pedido=await order(),url='/api/pedidos/'+pedido.id+'/pago/practica';await api.post(url).send({metodo:'transfer'}).expect(401);await post(pedido.id,{metodo:'transfer'},users[1]).expect(404);await post(pedido.id,{metodo:'transfer'}).expect(503);assert.equal(await fixture.db.pagoPractica.count(),0);
});
test('rechaza números, CVV, importes y marcas manipuladas antes de guardar',async()=>{
 process.env.PAYMENT_PRACTICE_ENABLED='true';const pedido=await order();
 for(const body of [{metodo:'card',marca:'visa',numero:'4111111111111234'},{metodo:'card',marca:'visa',cvv:'123'},{metodo:'transfer',totalCentavos:1},{metodo:'card',marca:'otro'},{metodo:'card',marca:{}},{metodo:'transfer',marca:'visa'}])await post(pedido.id,body).expect(422);
 assert.equal(await fixture.db.pagoPractica.count(),0);assert.equal(await fixture.db.pago.count(),0);
});
test('el modo de práctica bloquea iniciar cobros comerciales',async()=>{
 process.env.PAYMENT_PRACTICE_ENABLED='true';const pedido=await order();const result=await api.post('/api/pedidos/'+pedido.id+'/pago/payphone').set(headers()).send({}).expect(409);assert.equal(result.body.error.code,'PAYMENT_PRACTICE_MODE');assert.equal(await fixture.db.pago.count(),0);
});
test('tarjeta y transferencia completan prácticas idempotentes sin aprobar pagos ni modificar stock',async()=>{
 process.env.PAYMENT_PRACTICE_ENABLED='true';const stock=await fixture.db.producto.findMany({select:{id:true,stock:true},orderBy:{id:'asc'}});
 for(const input of [{metodo:'card',marca:'visa'},{metodo:'transfer'}]){const pedido=await order(),response=await post(pedido.id,input).expect(200),result=response.body.data.practica.resultado;assert.equal(result.metodo,input.metodo);assert.equal(result.marca,input.marca||null);assert.equal(result.totalCentavos,1150);assert.equal(response.body.data.pago,null);assert.equal(response.body.data.pedido.estado,'pendiente');const repeated=await post(pedido.id,input).expect(200);assert.equal(repeated.body.data.practica.resultado.id,result.id);assert.equal(await fixture.db.pagoPractica.count({where:{pedidoId:pedido.id}}),1);}
 assert.equal(await fixture.db.pago.count(),0);assert.deepEqual(await fixture.db.producto.findMany({select:{id:true,stock:true},orderBy:{id:'asc'}}),stock);
});
test('concurrencia no duplica la práctica y respeta pedidos cerrados o pagos existentes',async()=>{
 process.env.PAYMENT_PRACTICE_ENABLED='true';const pedido=await order();const results=await Promise.all([post(pedido.id,{metodo:'transfer'}),post(pedido.id,{metodo:'transfer'})]);assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(await fixture.db.pagoPractica.count({where:{pedidoId:pedido.id}}),1);
 const closed=await order();await fixture.db.pedido.update({where:{id:closed.id},data:{estado:'cancelado'}});await post(closed.id,{metodo:'transfer'}).expect(409);
 const real=await order();await fixture.db.pago.create({data:{pedidoId:real.id,entorno:'production',totalCentavos:1150,sinIvaCentavos:0,baseIvaCentavos:1000,ivaCentavos:150}});await post(real.id,{metodo:'transfer'}).expect(409);assert.equal(await fixture.db.pagoPractica.count({where:{pedidoId:real.id}}),0);
});
test('las restricciones de la tabla de práctica rechazan datos inconsistentes',async()=>{
 const pedido=await order();for(const data of [{metodo:'transfer',marca:'visa',totalCentavos:1150},{metodo:'card',marca:null,totalCentavos:1150},{metodo:'transfer',marca:null,totalCentavos:-1}])await assert.rejects(fixture.db.pagoPractica.create({data:{pedidoId:pedido.id,...data}}));
 if(fixture.provider==='postgresql'){const rows=await fixture.db.$queryRawUnsafe('SELECT relrowsecurity FROM pg_class WHERE oid=\'public."PagoPractica"\'::regclass');assert.equal(rows[0].relrowsecurity,true);}
});
