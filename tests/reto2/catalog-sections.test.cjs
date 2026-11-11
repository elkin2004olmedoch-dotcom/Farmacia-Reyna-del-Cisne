const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const {db,request}=require('./fixture.cjs');
const policy=require('../../frontend/models/pharmacy-policy.js');
const sectionIds=['bienestar','cuidado','bebe','medicamentos','salud-digestiva','dermocosmetica','proteccion-solar','higiene-bucal','cuidado-capilar','higiene-intima','salud-sexual','primeros-auxilios','equipos-medicos','adulto-mayor','cuidado-ocular-nasal','ortopedia'];
const buyer={name:'Cliente Secciones',email:'secciones@example.ec',phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:'pickup'};
const input=patch=>({nombre:'Referencia '+randomUUID().slice(0,8),precio:8,stock:5,categoria:'cuidado',descripcion:'Referencia sintética para comprobar el catálogo',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de prueba',...patch});
const auth=user=>({Authorization:'Bearer '+jwt.sign({version:user.tokenVersion},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
const admin=async()=>auth(await db.usuario.findFirst({where:{role:'admin'}}));
const campaign=productoId=>({titulo:'Campaña sintética',descripcion:'Campaña para comprobar permisos comerciales',etiqueta:'Prueba',productoId,activa:true,vistaPrevia:false,orden:0,descuentoPorcentaje:10});
after(()=>db.$disconnect());

test('las secciones públicas incluyen las dieciséis opciones y sus conteos activos reales',async()=>{
 const filters=(await request.get('/api/productos/filtros').expect(200)).body.data;
 assert.deepEqual(filters.categorias?.map(section=>section.id),sectionIds);
 assert.ok(Array.isArray(filters.laboratorios));assert.ok(Array.isArray(filters.presentaciones));
 for(const section of filters.categorias){
  assert.ok(section.nombre);assert.ok(section.descripcion);assert.equal(typeof section.imagen,'string');
  assert.equal(section.total,await db.producto.count({where:{activo:true,categoria:section.id}}));
 }
 const headers=await admin();
 for(const categoria of sectionIds){
  const created=(await request.post('/api/productos').set(headers).send(input({categoria})).expect(201)).body.data;
  assert.equal(created.soloConsulta,false);
  const page=(await request.get('/api/productos').query({categoria,q:created.nombre}).expect(200)).body.data;
  assert.deepEqual(page.items.map(product=>product.id),[created.id]);
  const suggestions=(await request.get('/api/productos/sugerencias').query({categoria,q:created.nombre}).expect(200)).body.data;
  assert.deepEqual(suggestions.items.map(product=>product.id),[created.id]);
 }
 await request.get('/api/productos?categoria=inexistente').expect(422);
 await request.get('/api/productos?categoria[]=cuidado').expect(422);
});

test('solo consulta bloquea compra y publicidad sin alterar la clasificación sanitaria',()=>{
 const consult={soloConsulta:true,precio:10,stock:20};
 assert.equal(policy.allowsPromotion(consult),false);
 assert.equal(policy.allowsPurchase(consult),false);
 assert.equal(policy.requiresProfessionalReview(consult),false);
 assert.match(policy.restrictionReason(consult),/consulta|disponibilidad/i);
 assert.equal(policy.allowsPurchase({precio:10}),true);
 assert.equal(policy.allowsPurchase(null),false);
 assert.equal(policy.allowsPurchase({requiereReceta:true}),false);
 const {effectivePrice}=require('../../server/models/prices.cjs');
 const priced=effectivePrice({...consult,descuentoPorcentaje:25},[{id:'consulta-promo',activa:true,vistaPrevia:false,descuentoPorcentaje:50,orden:0}]);
 assert.equal(Number(priced.precio),10);assert.equal(priced.descuentoPorcentaje,0);assert.equal(priced.promocionId,null);
});

test('crear y activar consulta exige autorización, booleano estricto y datos comerciales y sanitarios completos',async()=>{
 const headers=await admin();
 await request.post('/api/productos').send(input({soloConsulta:true})).expect(401);
 const customer=await db.usuario.create({data:{nombre:buyer.name,email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}});
 await request.post('/api/productos').set(auth(customer)).send(input({soloConsulta:true})).expect(403);
 for(const soloConsulta of ['true',1,null])await request.post('/api/productos').set(headers).send(input({soloConsulta})).expect(422);
 const body=input({tipoProducto:'medicamento',categoria:'medicamentos',soloConsulta:true,precio:0,stock:0});
 const created=(await request.post('/api/productos').set(headers).send(body).expect(201)).body.data,url='/api/productos/'+created.id;
 assert.equal(created.soloConsulta,true);assert.equal(created.requiereReceta,false);assert.equal(created.pvpMaximo,null);
 const filters=(await request.get('/api/productos/filtros').expect(200)).body.data;
 assert.equal(filters.categorias.find(section=>section.id==='medicamentos').total,await db.producto.count({where:{activo:true,categoria:'medicamentos'}}));
 await assert.rejects(db.producto.update({where:{id:created.id},data:{soloConsulta:false}}));
 await request.patch(url).set(headers).send({soloConsulta:false,esperadoUpdatedAt:created.updatedAt}).expect(422);
 await request.patch(url).set(headers).send({soloConsulta:false,precio:10,esperadoUpdatedAt:created.updatedAt}).expect(422);
 const complete={soloConsulta:false,precio:10,stock:4,pvpMaximo:12,laboratorio:'Empresa sintética',presentacion:'Caja sintética',registroSanitario:'REGISTRO-SINTETICO',requiereReceta:true,esperadoUpdatedAt:created.updatedAt};
 const attempts=await Promise.all([request.patch(url).set(headers).send(complete),request.patch(url).set(headers).send(complete)]);
 assert.deepEqual(attempts.map(result=>result.status).sort(),[200,409]);
 const activated=attempts.find(result=>result.status===200).body.data;
 assert.equal(activated.soloConsulta,false);assert.equal(activated.requiereReceta,true);
 await request.patch(url).set(headers).send({soloConsulta:true,esperadoUpdatedAt:created.updatedAt}).expect(409);
 const saved=await db.producto.findUnique({where:{id:created.id}});assert.equal(saved.soloConsulta,false);assert.equal(saved.stock,4);
 const ordinary=(await request.post('/api/productos').set(headers).send(input({soloConsulta:true,precio:0})).expect(201)).body.data;
 await request.patch('/api/productos/'+ordinary.id).set(headers).send({soloConsulta:false,esperadoUpdatedAt:ordinary.updatedAt}).expect(422);
});

test('carrito anterior, recompra y favoritos reciben el estado vigente y una compra directa no reserva consulta',async()=>{
 const headers=await admin(),customer=await db.usuario.create({data:{nombre:buyer.name,email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}}),customerHeaders=auth(customer);
 const body=input(),created=(await request.post('/api/productos').set(headers).send(body).expect(201)).body.data;
 const purchase={carrito:[{productoId:created.id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()};
 const order=(await request.post('/api/pedidos').set(customerHeaders).send(purchase).expect(201)).body.data;
 const current=await db.producto.findUnique({where:{id:created.id}});
 await request.patch('/api/productos/'+created.id).set(headers).send({soloConsulta:true,precio:0,stock:0,esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(200);
 const orders=await db.pedido.count(),movements=await db.movimientoInventario.count({where:{productoId:created.id}});
 const rejected=await request.post('/api/pedidos').set(customerHeaders).send({...purchase,claveSolicitud:randomUUID()}).expect(409);
 assert.equal(rejected.body.error.code,'PRODUCT_CONSULTATION_ONLY');
 await request.post('/api/pedidos').set(customerHeaders).send({...purchase,claveSolicitud:randomUUID(),carrito:[{productoId:created.id,cantidad:1,soloConsulta:false,precio:1}]}).expect(422);
 assert.equal(await db.pedido.count(),orders);assert.equal(await db.movimientoInventario.count({where:{productoId:created.id}}),movements);
 assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,0);
 await request.put('/api/cuenta/favoritos/'+created.id).set(customerHeaders).send({}).expect(200);
 const favorites=(await request.get('/api/cuenta/favoritos').set(customerHeaders).expect(200)).body.data;assert.equal(favorites[0].producto.soloConsulta,true);
 const reordered=(await request.get('/api/cuenta/pedidos/'+order.id+'/recompra').set(customerHeaders).expect(200)).body.data;assert.equal(reordered.items[0].soloConsulta,true);assert.equal(reordered.items[0].cantidadPermitida,0);assert.deepEqual(reordered.items[0].incidencias,['SOLO_CONSULTA']);
 const replay=await request.post('/api/pedidos').set(customerHeaders).send(purchase).expect(200);assert.equal(replay.body.data.id,order.id);
});

test('consulta queda al final en ambos órdenes de precio y retira campañas anteriores sin borrarlas',async()=>{
 const headers=await admin(),label='OrdenConsulta'+randomUUID().slice(0,8);
 const cheap=(await request.post('/api/productos').set(headers).send(input({nombre:label+' A',precio:3})).expect(201)).body.data;
 const expensive=(await request.post('/api/productos').set(headers).send(input({nombre:label+' B',precio:9})).expect(201)).body.data;
 const pending=(await request.post('/api/productos').set(headers).send(input({nombre:label+' C',precio:1})).expect(201)).body.data;
 const promo=(await request.post('/api/promociones').set(headers).send(campaign(pending.id)).expect(201)).body.data;
 const campaignsBefore=(await request.get('/api/admin/resumen').set(headers).expect(200)).body.data.indicadores.campanasVisibles;
 await request.patch('/api/productos/'+pending.id).set(headers).send({soloConsulta:true,esperadoUpdatedAt:pending.updatedAt}).expect(200);
 for(const [sort,expected] of [['low',[cheap.id,expensive.id,pending.id]],['high',[expensive.id,cheap.id,pending.id]]]){
  const listed=(await request.get('/api/productos').query({q:label,sort}).expect(200)).body.data;
  assert.deepEqual(listed.items.map(product=>product.id),expected);assert.equal(listed.items[2].soloConsulta,true);
 }
 assert.ok(!(await request.get('/api/promociones').expect(200)).body.data.some(item=>item.id===promo.id));
 assert.equal((await request.get('/api/admin/resumen').set(headers).expect(200)).body.data.indicadores.campanasVisibles,campaignsBefore-1);
 assert.ok(await db.promocion.findUnique({where:{id:promo.id}}));
 await request.post('/api/promociones').set(headers).send(campaign(pending.id)).expect(422);
 await request.patch('/api/promociones/'+promo.id).set(headers).send({titulo:'No publicable',esperadoUpdatedAt:promo.updatedAt}).expect(422);
 await request.patch('/api/productos/'+pending.id).set(headers).send({descuentoPorcentaje:20,esperadoUpdatedAt:(await db.producto.findUnique({where:{id:pending.id}})).updatedAt.toISOString()}).expect(422);
});

test('PUT compatible conserva solo consulta omitido y PATCH no convierte una referencia en venta implícita',async()=>{
 const headers=await admin(),body=input({soloConsulta:true,precio:0,stock:0,categoria:'ortopedia'});
 const created=(await request.post('/api/productos').set(headers).send(body).expect(201)).body.data,url='/api/productos/'+created.id;
 const {soloConsulta,...legacyBody}=body;
 await request.put(url).set(headers).send({...body,soloConsulta:false,esperadoUpdatedAt:created.updatedAt}).expect(422);
 const updated=(await request.put(url).set(headers).send({...legacyBody,nombre:'Referencia modificada',esperadoUpdatedAt:created.updatedAt}).expect(200)).body.data;
 assert.equal(updated.soloConsulta,true);
 const patched=(await request.patch(url).set(headers).send({precio:12,stock:3,esperadoUpdatedAt:updated.updatedAt}).expect(200)).body.data;
 assert.equal(patched.soloConsulta,true);assert.equal(Number(patched.precio),12);assert.equal(patched.stock,3);
 const page=(await request.get(url).expect(200)).body.data;
 assert.equal(page.soloConsulta,true);assert.equal(Number(page.precio),12);assert.equal(page.stock,3);
 await request.post('/api/productos').set(headers).send(input({precio:0})).expect(422);
});

test('las referencias de consulta cuentan en catálogo sin generar alertas de stock no confirmado',async()=>{
 const headers=await admin(),before=(await request.get('/api/admin/resumen').set(headers).expect(200)).body.data;
 const created=(await request.post('/api/productos').set(headers).send(input({soloConsulta:true,precio:0,stock:0})).expect(201)).body.data;
 const after=(await request.get('/api/admin/resumen').set(headers).expect(200)).body.data;
 assert.equal(after.indicadores.productosActivos,before.indicadores.productosActivos+1);
 assert.equal(after.indicadores.stockBajo,before.indicadores.stockBajo);
 assert.ok(!after.alertas.some(product=>product.id===created.id));
});
