const {test,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createFixture}=require('./email-api-fixture.cjs');
const fixture=createFixture(),{db}=fixture,api=fixture.api(false),geo=require('../../server/models/geocoding.cjs'),original=geo.resolve;
after(async()=>{geo.resolve=original;await fixture.close();});
let user,product,order;
const buyer={name:'Cliente Nacional',email:'nacional@example.ec',phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Azuay',city:'Cuenca',address:'Avenida Solano numero 123',postalCode:'010101',zonaEntregaId:'ecuador-nacional',esperadoTarifaVersion:1};
const input=()=>({carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer},claveSolicitud:randomUUID()});
const headers=()=>({Authorization:'Bearer '+user.token});
test('cobertura nacional gratuita: dirección resuelta, total correcto y destino guardado sin pedir coordenadas',async()=>{
 const zone=await db.zonaEntrega.findUnique({where:{id:'ecuador-nacional'}});assert.ok(zone);assert.equal(zone.alcance,'nacional');assert.equal(zone.tarifaCentavos,0);
 user=(await api.post('/api/auth/register').send({nombre:buyer.name,email:buyer.email,telefono:buyer.phone,cedula:buyer.document,password:'NacionalPrueba2026!'}).expect(201)).body.data;
 product=await db.producto.create({data:{nombre:'Cuidado nacional',precio:5,stock:20,categoria:'cuidado',descripcion:'Artículo sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Cuidado'}});
 geo.resolve=async target=>{assert.equal(target.ciudad,'Cuenca');return {latitud:-2.9,longitud:-79.0,fuente:'direccion'};};
 const quote=await api.post('/api/entregas/verificar-destino').set(headers()).send({province:buyer.province,city:buyer.city,address:buyer.address,zonaEntregaId:buyer.zonaEntregaId}).expect(200);assert.equal(quote.body.data.delivery,'delivery');
 const payload=input();order=(await api.post('/api/pedidos').set(headers()).send(payload).expect(201)).body.data;
 assert.equal(Number(order.total),5);assert.equal(order.costoEnvioCentavos,0);assert.equal(order.latitudEntrega,-2.9);assert.equal(order.longitudEntrega,-79);
 geo.resolve=async()=>{throw new Error('No debe repetirse la búsqueda en un replay.');};await api.post('/api/pedidos').set(headers()).send(payload).expect(200);
});
test('destino no localizado: indica retiro antes de crear el pedido, sin stock ni cobro de envío',async()=>{
 const {AppError}=require('../../server/middleware/errors.cjs');geo.resolve=async()=>{throw new AppError(409,'ADDRESS_NOT_FOUND','No encontrado.');};
 const before=await db.pedido.count(),stock=(await db.producto.findUnique({where:{id:product.id}})).stock;
 const res=await api.post('/api/entregas/verificar-destino').set(headers()).send({province:buyer.province,city:buyer.city,address:'Calle desconocida numero 999',zonaEntregaId:buyer.zonaEntregaId}).expect(200);assert.equal(res.body.data.delivery,'pickup');assert.match(res.body.data.message,/retiro/i);
 const failed=await api.post('/api/pedidos').set(headers()).send(input()).expect(409);assert.equal(failed.body.error.code,'DELIVERY_PICKUP_REQUIRED');assert.equal(await db.pedido.count(),before);assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,stock);
});
test('cobertura valida las 24 provincias y rechaza puntos extranjeros y campos imprevistos',async()=>{
 const v=require('../../frontend/models/ecuador.js'),zone={alcance:'nacional',activa:true};for(const province of v.provinces)assert.equal(v.matchesDeliveryZone(zone,{province,city:'Cantón de prueba'}),true);
 assert.equal(v.ecuadorPoint(-.74,-90.3),true);assert.equal(v.ecuadorPoint(40.7,-74),false);
 await api.post('/api/entregas/verificar-destino').send({}).expect(401);
 await api.post('/api/entregas/verificar-destino').set(headers()).send({province:'Colombia',city:'Bogotá',address:buyer.address,zonaEntregaId:buyer.zonaEntregaId}).expect(422);
 await api.post('/api/entregas/verificar-destino').set(headers()).send({province:buyer.province,city:buyer.city,address:buyer.address,zonaEntregaId:buyer.zonaEntregaId,tarifaCentavos:0}).expect(422);
 const body=input();Object.assign(body.comprador,{latitudEntrega:40.7,longitudEntrega:-74,consienteUbicacion:true});await api.post('/api/pedidos').set(headers()).send(body).expect(422);
});
test('administración cambia la tarifa nacional con versión e historial sin alterar pedidos ni tarifa local',async()=>{
 const model=require('../../server/models/entregas.cjs'),admin=await db.usuario.findFirst({where:{role:'admin'}}),before=await db.zonaEntrega.findUnique({where:{id:'puerto-quito'}}),zone=await db.zonaEntrega.findUnique({where:{id:'ecuador-nacional'}});
 const updated=await model.saveZone(zone.id,{nombre:zone.nombre,provincia:zone.provincia,canton:zone.canton,tarifaCentavos:300,ivaCategoria:'general',fundamentoIva:null,activa:true,esperadoVersion:zone.version},admin);
 assert.equal(updated.alcance,'nacional');assert.equal(updated.version,2);assert.equal((await db.zonaEntregaTarifa.findFirst({where:{zonaEntregaId:zone.id,version:2}})).alcance,'nacional');
 assert.equal((await db.pedido.findUnique({where:{id:order.id}})).costoEnvioCentavos,0);assert.deepEqual(await db.zonaEntrega.findUnique({where:{id:'puerto-quito'}}),before);
 await assert.rejects(model.saveZone(zone.id,{alcance:'local',esperadoVersion:updated.version},admin),error=>error.code==='ZONE_SCOPE_IN_USE');
 const bad={...updated,alcance:'extranjero'};await assert.rejects(db.zonaEntrega.update({where:{id:zone.id},data:{alcance:bad.alcance}}));
});
