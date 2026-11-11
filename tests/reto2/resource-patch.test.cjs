'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fixture=require('./email-api-fixture.cjs').createFixture();
const {db}=fixture,api=fixture.api(false);
const supplierInput={nombre:'Proveedor sintético',ruc:'0102030400001',email:'proveedor-patch@example.ec',telefono:'0979275988',direccion:'Calle de prueba 123 frente al parque',activo:true};
let admin,user,product;
const authorize=(request,session=admin)=>request.set('Authorization','Bearer '+session.token);
const supplier=()=>db.proveedor.upsert({where:{ruc:supplierInput.ruc},create:{...supplierInput,telefono:'+593979275988'},update:{activo:true}});
async function promotion(values={}){
 return (await authorize(api.post('/api/promociones')).send({titulo:'Campaña sintética',descripcion:'Campaña para pruebas aisladas',etiqueta:'Prueba',productoId:product.id,activa:false,vistaPrevia:false,orden:1,inicio:'2030-01-01T00:00:00.000Z',fin:'2030-02-01T00:00:00.000Z',...values}).expect(201)).body.data;
}
before(async()=>{
 admin=(await api.post('/api/auth/login').send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200)).body.data;
 user=(await api.post('/api/auth/register').send({nombre:'Cliente Sintético',email:'cliente-patch@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClientePatch2026!'}).expect(201)).body.data;
 product=(await authorize(api.post('/api/productos')).send({nombre:'Producto para campañas',precio:11.40,stock:3,categoria:'cuidado',descripcion:'Producto de prueba aislada',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba'}).expect(201)).body.data;
});
after(()=>fixture.close());

test('la ficha privada del proveedor exige administrador y devuelve 404 para un id ausente',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id;
 await api.get(url).expect(401);
 await authorize(api.get(url),user).expect(403);
 const response=await authorize(api.get(url)).expect(200);
 assert.equal(response.body.data.ruc,supplierInput.ruc);
 await authorize(api.get('/api/admin/proveedores/'+randomUUID())).expect(404);
});

test('PATCH proveedor conserva campos omitidos, normaliza entradas y detecta la versión anterior',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id;
 const response=await authorize(api.patch(url)).send({nombre:'  Proveedor actualizado  ',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(200);
 assert.equal(response.body.data.nombre,'Proveedor actualizado');
 assert.equal(response.body.data.ruc,saved.ruc);
 assert.equal(response.body.data.email,saved.email);
 assert.notEqual(response.body.data.updatedAt,saved.updatedAt.toISOString());
 await authorize(api.patch(url)).send({nombre:'Edición obsoleta',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(409);
 assert.equal((await db.proveedor.findUnique({where:{id:saved.id}})).nombre,'Proveedor actualizado');
});

test('PATCH proveedor rechaza escritura anónima, rol de cliente, campos ajenos y cuerpos incompletos',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id,version=saved.updatedAt.toISOString();
 await api.patch(url).send({activo:false,esperadoUpdatedAt:version}).expect(401);
 await authorize(api.patch(url),user).send({activo:false,esperadoUpdatedAt:version}).expect(403);
 for(const body of [{activo:false},{esperadoUpdatedAt:version},{nombre:null,esperadoUpdatedAt:version},{activo:'false',esperadoUpdatedAt:version},{ruc:'123',esperadoUpdatedAt:version},{role:'admin',esperadoUpdatedAt:version},{nombre:'Nuevo proveedor',esperadoUpdatedAt:'2030-01-01'}])await authorize(api.patch(url)).send(body).expect(422);
 assert.equal((await db.proveedor.findUnique({where:{id:saved.id}})).activo,true);
});

test('baja lógica de proveedor exige versión y conserva lotes asociados',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id;
 const lot=await db.lote.create({data:{productoId:product.id,numero:randomUUID(),vencimiento:'2035-01-01',stock:0,costoUnitario:1,proveedorId:saved.id}});
 await authorize(api.delete(url)).send({}).expect(422);
 await authorize(api.delete(url)).send({esperadoUpdatedAt:'2000-01-01T00:00:00.000Z'}).expect(409);
 await authorize(api.delete(url)).send({esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(204);
 await authorize(api.delete(url)).send({esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(204);
 assert.equal((await db.proveedor.findUnique({where:{id:saved.id}})).activo,false);
 assert.equal((await db.lote.findUnique({where:{id:lot.id}})).proveedorId,saved.id);
});

test('PUT proveedor conserva el contrato existente y acepta control de versión opcional',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id;
 const updated=(await authorize(api.put(url)).send({...supplierInput,nombre:'Proveedor PUT',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(200)).body.data;
 await authorize(api.put(url)).send({...supplierInput,nombre:'Sobrescritura obsoleta',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(409);
 await authorize(api.put(url)).send({...supplierInput,nombre:'Cliente existente sin versión'}).expect(200);
 assert.notEqual(updated.updatedAt,saved.updatedAt.toISOString());
});

test('la ficha administrativa de promoción permite consultar borradores sin publicarlos',async()=>{
 const saved=await promotion(),url='/api/admin/promociones/'+saved.id;
 await api.get(url).expect(401);
 await authorize(api.get(url),user).expect(403);
 const response=await authorize(api.get(url)).expect(200);
 assert.equal(response.body.data.id,saved.id);
 assert.equal(response.body.data.activa,false);
 assert.ok(response.body.data.updatedAt);
 assert.equal((await api.get('/api/promociones').expect(200)).body.data.some(row=>row.id===saved.id),false);
 await authorize(api.get('/api/admin/promociones/'+randomUUID())).expect(404);
});

test('PATCH promoción conserva fechas omitidas y valida el intervalo contra el registro guardado',async()=>{
 const saved=await promotion(),url='/api/promociones/'+saved.id;
 const updated=(await authorize(api.patch(url)).send({titulo:'Campaña editada',esperadoUpdatedAt:saved.updatedAt}).expect(200)).body.data;
 assert.equal(updated.inicio,saved.inicio);
 assert.equal(updated.fin,saved.fin);
 assert.equal(updated.productoId,saved.productoId);
 await authorize(api.patch(url)).send({fin:'2029-12-01T00:00:00.000Z',esperadoUpdatedAt:updated.updatedAt}).expect(422);
 await authorize(api.patch(url)).send({titulo:'Versión anterior',esperadoUpdatedAt:saved.updatedAt}).expect(409);
 const cleared=(await authorize(api.patch(url)).send({inicio:null,fin:null,esperadoUpdatedAt:updated.updatedAt}).expect(200)).body.data;
 assert.equal(cleared.inicio,null);
 assert.equal(cleared.fin,null);
});

test('PATCH promoción verifica roles, versión, campos permitidos y restricciones del producto',async()=>{
 const saved=await promotion(),url='/api/promociones/'+saved.id;
 await api.patch(url).send({activa:true,esperadoUpdatedAt:saved.updatedAt}).expect(401);
 await authorize(api.patch(url),user).send({activa:true,esperadoUpdatedAt:saved.updatedAt}).expect(403);
 for(const body of [{activa:true},{esperadoUpdatedAt:saved.updatedAt},{createdAt:'2030-01-01',esperadoUpdatedAt:saved.updatedAt},{descuentoPorcentaje:86,esperadoUpdatedAt:saved.updatedAt}])await authorize(api.patch(url)).send(body).expect(422);
 const restricted=await db.producto.create({data:{nombre:'Producto restringido',precio:1,stock:0,categoria:'cuidado',descripcion:'Producto restringido sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético',controlado:true}});
 await authorize(api.patch(url)).send({productoId:restricted.id,esperadoUpdatedAt:saved.updatedAt}).expect(422);
 assert.equal((await db.promocion.findUnique({where:{id:saved.id}})).productoId,product.id);
});

test('PUT promoción admite versión opcional y conserva compatibilidad sin versión',async()=>{
 const saved=await promotion(),url='/api/promociones/'+saved.id;
 const values={titulo:saved.titulo,descripcion:saved.descripcion,etiqueta:saved.etiqueta,productoId:saved.productoId,activa:saved.activa,vistaPrevia:saved.vistaPrevia,orden:saved.orden,inicio:saved.inicio,fin:saved.fin};
 await authorize(api.put(url)).send({...values,titulo:'Edición con versión',esperadoUpdatedAt:saved.updatedAt}).expect(200);
 await authorize(api.put(url)).send({...values,titulo:'Edición obsoleta',esperadoUpdatedAt:saved.updatedAt}).expect(409);
 const {inicio,fin,...withoutDates}=values;
 const legacy=(await authorize(api.put(url)).send({...withoutDates,titulo:'Edición compatible'}).expect(200)).body.data;
 assert.equal(legacy.inicio,null);
 assert.equal(legacy.fin,null);
});

test('dos ediciones concurrentes sólo guardan una versión de proveedor y promoción',async()=>{
 const savedSupplier=await supplier(),savedPromotion=await promotion();
 const resources=[
  {url:'/api/admin/proveedores/'+savedSupplier.id,version:savedSupplier.updatedAt.toISOString(),changes:[{nombre:'Proveedor concurrente uno'},{nombre:'Proveedor concurrente dos'}]},
  {url:'/api/promociones/'+savedPromotion.id,version:savedPromotion.updatedAt,changes:[{titulo:'Campaña concurrente uno'},{titulo:'Campaña concurrente dos'}]},
 ];
 for(const resource of resources){
  const responses=await Promise.all(resource.changes.map(values=>authorize(api.patch(resource.url)).send({...values,esperadoUpdatedAt:resource.version})));
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const winner=responses.find(response=>response.status===200).body.data;
  const persisted=resource===resources[0]?await db.proveedor.findUnique({where:{id:savedSupplier.id}}):await db.promocion.findUnique({where:{id:savedPromotion.id}});
  assert.equal(persisted.updatedAt.toISOString(),winner.updatedAt);
  assert.equal(persisted.nombre??persisted.titulo,winner.nombre??winner.titulo);
 }
});

test('PATCH con cookie exige origen y cabecera web y valida los identificadores antes de consultar',async()=>{
 const saved=await supplier(),url='/api/admin/proveedores/'+saved.id,body={nombre:'Cambio con sesión web',esperadoUpdatedAt:saved.updatedAt.toISOString()};
 const login=await api.post('/api/auth/login').set('Origin','http://localhost:3300').set('X-Farmacia-Web','1').send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
 const cookies=login.headers['set-cookie'];
 await api.patch(url).set('Cookie',cookies).send(body).expect(403);
 await api.patch(url).set('Cookie',cookies).set('X-Farmacia-Web','1').send(body).expect(403);
 await api.patch(url).set('Cookie',cookies).set('X-Farmacia-Web','1').set('Origin','http://localhost:3300').send(body).expect(200);
 for(const path of ['/api/admin/proveedores/INVALID_ID','/api/promociones/INVALID_ID'])await authorize(api.patch(path)).send({nombre:'Cambio inválido',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(422);
 await authorize(api.patch('/api/admin/proveedores/'+randomUUID())).send({nombre:'Proveedor ausente',esperadoUpdatedAt:saved.updatedAt.toISOString()}).expect(404);
});

test('favoritos usa IVA vigente y coincide con el desglose del catálogo',async()=>{
 await db.configuracionFiscal.create({data:{tarifaGeneral:14,inicioVigencia:new Date(Date.now()-1000),referenciaNormativa:'Tarifa sintética para comprobar favoritos'}});
 await authorize(api.put('/api/cuenta/favoritos/'+product.id),user).send({}).expect(200);
 const favorite=(await authorize(api.get('/api/cuenta/favoritos'),user).expect(200)).body.data.find(row=>row.productoId===product.id).producto;
 assert.equal(favorite.ivaPorcentaje,14);
 assert.equal(Number(favorite.baseImponible),10);
 assert.equal(Number(favorite.ivaMonto),1.40);
 const catalog=(await api.get('/api/productos/'+product.id).expect(200)).body.data;
 assert.equal(favorite.baseImponible,catalog.baseImponible);
 assert.equal(favorite.ivaMonto,catalog.ivaMonto);
});
