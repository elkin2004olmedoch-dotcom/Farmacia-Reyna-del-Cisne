const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {db,request,directory}=require('./fixture.cjs');
let staff,customer;
const buyer={name:'Cliente Promoción',email:'promocion-prueba@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''};
const bearer=token=>'Bearer '+token;
const campaign=(productoId,patch={})=>({titulo:'Campaña de publicación sintética',descripcion:'Prueba aislada de publicación y descuento',etiqueta:'Promoción de prueba',productoId,activa:true,vistaPrevia:true,descuentoPorcentaje:26,orden:1,inicio:null,fin:null,...patch});
async function product(patch={}){return (await request.post('/api/productos').set('Authorization',bearer(staff)).send({nombre:'Producto promoción '+randomUUID(),precio:9.75,stock:50,categoria:'cuidado',descripcion:'Producto sintético para comprobar promociones',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético',...patch}).expect(201)).body.data;}
async function placeOrder(productoId,cantidad=2){return (await request.post('/api/pedidos').set('Authorization',bearer(customer)).send({carrito:[{productoId,cantidad}],comprador:buyer,claveSolicitud:randomUUID()}).expect(201)).body.data;}
before(async()=>{
  staff=(await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200)).body.data.token;
  customer=(await request.post('/api/auth/register').send({nombre:buyer.name,email:buyer.email,telefono:buyer.phone,cedula:buyer.document,password:'PromoPrueba2026!'}).expect(201)).body.data.token;
});
test('guardar vista previa de 26 % no rebaja el precio; publicarla aplica una vez en producto, campaña y pedido',async()=>{
  const item=await product(),values=campaign(item.id);
  const saved=(await request.post('/api/promociones').set('Authorization',bearer(staff)).send(values).expect(201)).body.data;
  let priced=(await request.get('/api/productos/'+item.id).expect(200)).body.data;
  assert.equal(Number(priced.precio),9.75);assert.equal(priced.descuentoPorcentaje,0);assert.equal(priced.promocionId,null);
  const preview=(await request.get('/api/promociones').expect(200)).body.data.find(row=>row.id===saved.id);
  assert.equal(preview.vistaPrevia,true);assert.equal(preview.descuentoPorcentaje,26);assert.equal(Number(preview.producto.precio),9.75);
  const before=await placeOrder(item.id);assert.equal(Number(before.total),19.5);assert.equal(before.detalles[0].descuentoPorcentaje,0);
  await request.put('/api/promociones/'+saved.id).set('Authorization',bearer(staff)).send({...values,vistaPrevia:false}).expect(200);
  priced=(await request.get('/api/productos/'+item.id).expect(200)).body.data;
  assert.equal(Number(priced.precio),7.22);assert.equal(Number(priced.precioOriginal),9.75);assert.equal(priced.descuentoPorcentaje,26);assert.equal(priced.promocionId,saved.id);
  const publicCampaign=(await request.get('/api/promociones').expect(200)).body.data.find(row=>row.id===saved.id);
  assert.equal(publicCampaign.vistaPrevia,false);assert.equal(Number(publicCampaign.producto.precio),7.22);
  assert.equal(Number((await request.get('/api/productos').expect(200)).body.data.items.find(row=>row.id===item.id).precio),7.22);
  const after=await placeOrder(item.id);assert.equal(Number(after.total),14.44);assert.equal(Number(after.detalles[0].precioUnitario),7.22);assert.equal(Number(after.detalles[0].precioOriginal),9.75);assert.equal(after.detalles[0].descuentoPorcentaje,26);
  assert.equal(Math.round(Number(after.baseImponible)*100)+Math.round(Number(after.ivaMonto)*100),1444);
  assert.equal(Number((await db.pedido.findUnique({where:{id:before.id}})).total),19.5);
  assert.equal((await db.promocion.findUnique({where:{id:saved.id}})).vistaPrevia,false);
});
test('campañas futuras, vencidas y no publicadas no se aplican aunque tengan porcentaje configurado',async()=>{
  for(const patch of [{inicio:new Date(Date.now()+86400000).toISOString()},{fin:new Date(Date.now()-86400000).toISOString()},{activa:false}]){
    const item=await product();const values=campaign(item.id,{vistaPrevia:false,...patch});
    const saved=(await request.post('/api/promociones').set('Authorization',bearer(staff)).send(values).expect(201)).body.data;
    const priced=(await request.get('/api/productos/'+item.id).expect(200)).body.data;
    assert.equal(Number(priced.precio),9.75);assert.equal(priced.descuentoPorcentaje,0);
    assert.ok(!(await request.get('/api/promociones').expect(200)).body.data.some(row=>row.id===saved.id));
    assert.equal(Number((await placeOrder(item.id,1)).total),9.75);
  }
});
test('publicar campaña no suma ni duplica descuento directo y conserva el mayor',async()=>{
  const item=await product({precio:100,descuentoPorcentaje:35});
  const saved=(await request.post('/api/promociones').set('Authorization',bearer(staff)).send(campaign(item.id,{vistaPrevia:false})).expect(201)).body.data;
  let priced=(await request.get('/api/productos/'+item.id).expect(200)).body.data;
  assert.equal(Number(priced.precio),65);assert.equal(priced.descuentoPorcentaje,35);assert.equal(priced.promocionId,null);
  await request.put('/api/promociones/'+saved.id).set('Authorization',bearer(staff)).send(campaign(item.id,{vistaPrevia:false,descuentoPorcentaje:40})).expect(200);
  priced=(await request.get('/api/productos/'+item.id).expect(200)).body.data;
  assert.equal(Number(priced.precio),60);assert.equal(priced.descuentoPorcentaje,40);assert.equal(Number(priced.precioOriginal),100);
  const order=await placeOrder(item.id);assert.equal(Number(order.total),120);assert.equal(order.detalles[0].descuentoPorcentaje,40);assert.equal(Number(order.detalles[0].precioUnitario),60);
});
after(async()=>{await db.$disconnect();const target=path.resolve(directory),prefix=path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-';if(!target.startsWith(prefix))throw new Error('La base de prueba debe permanecer en su directorio temporal.');fs.rmSync(target,{recursive:true,force:true});});
