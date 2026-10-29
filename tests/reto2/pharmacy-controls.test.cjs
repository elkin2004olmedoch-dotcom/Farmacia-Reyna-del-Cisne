const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomUUID}=require('node:crypto');
const {db,request,directory}=require('./fixture.cjs');
let headers;
async function admin(){if(!headers){const login=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);headers={Authorization:'Bearer '+login.body.data.token};}return headers;}
const medicine=patch=>({nombre:'Medicamento sintético '+randomUUID().slice(0,8),precio:10,pvpMaximo:15,stock:5,categoria:'bienestar',descripcion:'Artículo artificial para comprobar restricciones sanitarias',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase artificial de prueba',tipoProducto:'medicamento',laboratorio:'Laboratorio de pruebas',presentacion:'Caja de prueba',registroSanitario:'REGISTRO-SINTETICO',requiereReceta:true,descuentoPorcentaje:0,...patch});
const campaign=productoId=>({titulo:'Campaña de prueba',descripcion:'Contenido sintético para comprobar exclusión',etiqueta:'Prueba',productoId,activa:true,vistaPrevia:false,orden:0,descuentoPorcentaje:10,inicio:null,fin:null});

test('los indicadores sanitarios se conservan y rechazan tipos no booleanos',async()=>{
  const staff=await admin();
  for(const field of ['controlado','biologico','cadenaFrio']){
    const created=await request.post('/api/productos').set(staff).send(medicine({[field]:true})).expect(201);assert.equal(created.body.data[field],true);
    await request.post('/api/productos').set(staff).send(medicine({[field]:'true'})).expect(422);
  }
});
test('el servidor rechaza publicidad y descuento directo de medicamentos sujetos a revisión',async()=>{
  const staff=await admin();
  for(const patch of [{requiereReceta:true},{controlado:true},{biologico:true}]){
    await request.post('/api/productos').set(staff).send(medicine({...patch,descuentoPorcentaje:10})).expect(422);
    const product=(await request.post('/api/productos').set(staff).send(medicine(patch)).expect(201)).body.data;
    const rejected=await request.post('/api/promociones').set(staff).send(campaign(product.id)).expect(422);assert.equal(rejected.body.error.code,'PHARMACY_PROMOTION_RESTRICTED');
  }
});
test('reclasificar un producto retira campañas públicas y evita su descuento sin borrar historial',async()=>{
  const staff=await admin();const input=medicine({requiereReceta:false});const product=(await request.post('/api/productos').set(staff).send(input).expect(201)).body.data;
  const promo=(await request.post('/api/promociones').set(staff).send(campaign(product.id)).expect(201)).body.data;
  await request.put('/api/productos/'+product.id).set(staff).send({...input,requiereReceta:true,esperadoUpdatedAt:product.updatedAt}).expect(200);
  const visible=await request.get('/api/promociones').expect(200);assert.ok(!visible.body.data.some(item=>item.id===promo.id));
  const current=(await request.get('/api/productos/'+product.id).expect(200)).body.data;assert.equal(current.descuentoPorcentaje,0);assert.equal(Number(current.precio),10);assert.ok(await db.promocion.findUnique({where:{id:promo.id}}));
});
after(async()=>{await db.$disconnect();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));fs.rmSync(directory,{recursive:true,force:true});});
