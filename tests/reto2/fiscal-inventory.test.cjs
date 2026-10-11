const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {db,request,directory}=require('./fixture.cjs');
const {inclusiveTax}=require('../../server/models/fiscal.cjs');
const inventory=require('../../server/models/inventario.cjs');
const productInput={nombre:'Producto fiscal sintético',precio:11.50,stock:20,categoria:'bienestar',descripcion:'Fixture aislada para validación fiscal e inventario',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de prueba'};
const buyer={name:'Cliente Fiscal',email:'fiscal-cliente@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''};
let adminToken,userToken,adminId;
const productIds=[],orderIds=[],supplierIds=[],fiscalIds=[];
const auth=token=>'Bearer '+token;
async function product(patch={}) {const medication=patch.tipoProducto==='medicamento'?{pvpMaximo:100,laboratorio:'Laboratorio sintético no habilitante',presentacion:'Caja de prueba',registroSanitario:'Registro sintético no habilitante'}:{};const response=await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,...medication,...patch}).expect(201);productIds.push(response.body.data.id);return response.body.data;}
async function order(id,cantidad=1,key=randomUUID()) {const response=await request.post('/api/pedidos').set('Authorization',auth(userToken)).send({carrito:[{productoId:id,cantidad}],comprador:buyer,claveSolicitud:key}).expect(201);orderIds.push(response.body.data.id);return response.body.data;}
const campaignInput=id=>({titulo:'Campaña fiscal sintética',descripcion:'Descuento de prueba aislado',etiqueta:'Promoción',productoId:id,activa:true,vistaPrevia:false,orden:1,inicio:null,fin:null,descuentoPorcentaje:20});
before(async()=> {
 const admin=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);adminToken=admin.body.data.token;adminId=admin.body.data.usuario.id;
 userToken=(await request.post('/api/auth/register').send({nombre:buyer.name,email:buyer.email,telefono:buyer.phone,cedula:buyer.document,password:'FiscalPrueba2026!'}).expect(201)).body.data.token;
});

test('descuento directo admite 85 %, persiste y conserva precio final original sin sumar IVA',async()=> {
 const created=await product({precio:100,descuentoPorcentaje:85});
 assert.equal(created.descuentoPorcentaje,85);assert.equal(Number(created.precio),100);
 const priced=(await request.get('/api/productos/'+created.id).expect(200)).body.data;
 assert.equal(Number(priced.precioOriginal),100);assert.equal(Number(priced.precio),15);assert.equal(priced.descuentoDirecto,85);assert.equal(priced.descuentoPorcentaje,85);assert.equal(priced.ivaPorcentaje,15);
 assert.equal(Math.round(Number(priced.baseImponible)*100)+Math.round(Number(priced.ivaMonto)*100),1500);
});
test('producto y campaña rechazan descuentos fraccionarios, cadenas, negativos y superiores a 85 en API y BD',async()=> {
 const created=await product();
 for(const descuentoPorcentaje of [-1,85.5,86,90,'85']) {
  await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,descuentoPorcentaje}).expect(422);
  await request.post('/api/promociones').set('Authorization',auth(adminToken)).send({...campaignInput(created.id),descuentoPorcentaje}).expect(422);
 }
 for(const descuentoPorcentaje of [-1,85.5,86])await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "Producto" SET "descuentoPorcentaje"=? WHERE "id"=?',descuentoPorcentaje,created.id));
 await assert.rejects(()=>db.promocion.create({data:{...campaignInput(created.id),descuentoPorcentaje:86}}));
});
test('el descuento efectivo aplica el máximo entre producto y campañas sin acumulación',async()=> {
 const created=await product({precio:100,descuentoPorcentaje:30});
 const campaign=(await request.post('/api/promociones').set('Authorization',auth(adminToken)).send(campaignInput(created.id)).expect(201)).body.data;
 let priced=(await request.get('/api/productos/'+created.id).expect(200)).body.data;
 assert.equal(Number(priced.precio),70);assert.equal(priced.descuentoPorcentaje,30);
 await request.put('/api/promociones/'+campaign.id).set('Authorization',auth(adminToken)).send({...campaignInput(created.id),descuentoPorcentaje:40}).expect(200);
 priced=(await request.get('/api/productos/'+created.id).expect(200)).body.data;
 assert.equal(Number(priced.precio),60);assert.equal(priced.descuentoPorcentaje,40);assert.equal(priced.promocionId,campaign.id);
});
test('configuración fiscal es pública en lectura y reservada a administrador en escritura',async()=> {
 const publicResponse=await request.get('/api/configuracion/fiscal').expect(200);
 assert.equal(publicResponse.body.data.tarifaGeneral,15);assert.ok(!('actorId' in publicResponse.body.data));
 await request.get('/api/admin/configuracion/fiscal').expect(401);
 await request.get('/api/admin/configuracion/fiscal').set('Authorization',auth(userToken)).expect(403);
 const body={tarifaGeneral:14,inicioVigencia:new Date(Date.now()-60000).toISOString(),referenciaNormativa:'Normativa sintética únicamente para esta prueba'};
 await request.post('/api/admin/configuracion/fiscal').send(body).expect(401);
 await request.post('/api/admin/configuracion/fiscal').set('Authorization',auth(userToken)).send(body).expect(403);
 for(const tarifaGeneral of [0,8,12,16,14.5,'14'])await request.post('/api/admin/configuracion/fiscal').set('Authorization',auth(adminToken)).send({...body,tarifaGeneral}).expect(422);
 await assert.rejects(()=>db.configuracionFiscal.create({data:{...body,tarifaGeneral:8,inicioVigencia:new Date(body.inicioVigencia),actorId:adminId}}));
});
test('vigencia ecuatoriana se programa, cambia el desglose y nunca modifica pedidos anteriores',async()=> {
 const created=await product();const original=await order(created.id,3);
 assert.equal(Number(original.total),34.50);assert.equal(Number(original.baseImponible),30);assert.equal(Number(original.ivaMonto),4.50);assert.equal(original.detalles[0].ivaPorcentaje,15);
 const current=(await request.post('/api/admin/configuracion/fiscal').set('Authorization',auth(adminToken)).send({tarifaGeneral:14,inicioVigencia:new Date(Date.now()-60000).toISOString(),referenciaNormativa:'Tarifa sintética 14 % exclusivamente de prueba'}).expect(201)).body.data;fiscalIds.push(current.id);
 const future=(await request.post('/api/admin/configuracion/fiscal').set('Authorization',auth(adminToken)).send({tarifaGeneral:13,inicioVigencia:new Date(Date.now()+2*86400000).toISOString(),referenciaNormativa:'Tarifa sintética futura 13 % exclusivamente de prueba'}).expect(201)).body.data;fiscalIds.push(future.id);
 try {
  const publicTax=(await request.get('/api/configuracion/fiscal').expect(200)).body.data;assert.equal(publicTax.tarifaGeneral,14);
  const priced=(await request.get('/api/productos/'+created.id).expect(200)).body.data;assert.equal(Number(priced.precio),11.50);assert.equal(priced.ivaPorcentaje,14);
  const next=await order(created.id,3);assert.equal(Number(next.total),34.50);assert.equal(next.detalles[0].ivaPorcentaje,14);
  const stored=await db.pedido.findUnique({where:{id:original.id},include:{detalles:true}});assert.equal(stored.detalles[0].ivaPorcentaje,15);assert.equal(Number(stored.ivaMonto),4.50);
  const futureConfig=await require('../../server/models/fiscal.cjs').current(db,new Date(Date.now()+3*86400000));assert.equal(futureConfig.tarifaGeneral,13);
  await request.post('/api/admin/configuracion/fiscal').set('Authorization',auth(adminToken)).send({tarifaGeneral:13,inicioVigencia:current.inicioVigencia,referenciaNormativa:'Fecha repetida en la configuración fiscal sintética'}).expect(409);
 } finally {await db.configuracionFiscal.deleteMany({where:{id:{in:[current.id,future.id]}}});}
});
test('IVA cero exige fundamento y conserva tarifa cero en el pedido sin inferir por nombre',async()=> {
 await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,ivaCategoria:'cero'}).expect(422);
 const created=await product({ivaCategoria:'cero',fundamentoIva:'Art. 55 LRTI: clasificación respaldada en esta prueba',tipoProducto:'medicamento'});
 const purchased=await order(created.id,2);assert.equal(purchased.detalles[0].ivaPorcentaje,0);assert.equal(Number(purchased.total),23);assert.equal(Number(purchased.baseImponible),23);assert.equal(Number(purchased.ivaMonto),0);
 await assert.rejects(()=>db.producto.update({where:{id:created.id},data:{fundamentoIva:null}}));
});
test('desglose fiscal por línea conserva centavos, descuentos y cabecera para valores pequeños y cantidades altas',()=> {
 for(const rate of [0,13,14,15])for(const unit of [0,1,4,99,1150,1050,10000000])for(const cantidad of [1,2,3,99]) {
  const total=unit*cantidad;const split=inclusiveTax(total,rate);
  const base=Math.round(Number(split.baseImponible)*100),iva=Math.round(Number(split.ivaMonto)*100);
  assert.equal(base+iva,total);assert.equal(base,Math.round(total*100/(100+rate)));assert.ok(base>=0 && iva>=0);
 }
 const tiny=inclusiveTax(4,15);assert.equal(Number(tiny.baseImponible),0.03);assert.equal(Number(tiny.ivaMonto),0.01);
});
test('ficha farmacéutica valida GTIN, código interno, receta, stock mínimo y campos desconocidos',async()=> {
 const created=await product({codigoInterno:'abc-01',codigoBarras:'7501031311309',laboratorio:'Laboratorio sintético',principioActivo:'Principio de prueba',concentracion:'10 mg',presentacion:'Caja de prueba',registroSanitario:'Registro de prueba no habilitante',stockMinimo:8});
 assert.equal(created.codigoInterno,'ABC-01');assert.equal(created.stockMinimo,8);
 for(const patch of [{codigoBarras:'7501031311308'},{codigoInterno:'con espacio'},{stockMinimo:-1},{requiereReceta:'true'},{tipoProducto:'inventado'},{laboratorio:'a'.repeat(121)},{fundamentoIva:'corto'},{campoNoPermitido:'x'}])await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,...patch}).expect(422);
 await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,codigoInterno:'ABC-01'}).expect(409);
});
test('medicamentos con receta no se venden mediante un carrito sin revisión presencial',async()=> {
 const created=await product({tipoProducto:'medicamento',requiereReceta:true});
 const blocked=await request.post('/api/pedidos').set('Authorization',auth(userToken)).send({carrito:[{productoId:created.id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()}).expect(409);
 assert.equal(blocked.body.error.code,'PRESCRIPTION_REQUIRED');assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,20);
});
test('proveedores validan RUC, correo, teléfono y dirección Ecuador y están protegidos por rol',async()=> {
 const input={nombre:'Proveedor sintético S A',ruc:'0102030400001',email:'proveedor@example.ec',telefono:'0979275988',direccion:'Calle sintética 123 y referencia',activo:true};
 await request.get('/api/admin/proveedores').expect(401);await request.get('/api/admin/proveedores').set('Authorization',auth(userToken)).expect(403);
 for(const patch of [{ruc:'0102030400002'},{telefono:'12345'},{email:'mal@'},{direccion:'x'},{activo:'true'}])await request.post('/api/admin/proveedores').set('Authorization',auth(adminToken)).send({...input,...patch}).expect(422);
 const created=(await request.post('/api/admin/proveedores').set('Authorization',auth(adminToken)).send(input).expect(201)).body.data;supplierIds.push(created.id);assert.equal(created.telefono,'+593979275988');
 await request.post('/api/admin/proveedores').set('Authorization',auth(adminToken)).send(input).expect(409);
 await request.put('/api/admin/proveedores/'+created.id).set('Authorization',auth(adminToken)).send({...input,activo:false}).expect(200);
 assert.equal((await request.get('/api/admin/proveedores').set('Authorization',auth(adminToken)).expect(200)).body.data.items.find(row=>row.id===created.id).activo,false);
});
test('ingreso por lote conserva stock previo y registra costo, vencimiento y movimiento',async()=> {
 const created=await product({stock:3});
 const input={productoId:created.id,numero:'LOTE-01',vencimiento:'2035-12-31',cantidad:5,costoUnitario:2.15,proveedorId:null};
 await request.post('/api/admin/lotes').set('Authorization',auth(userToken)).send(input).expect(403);
 const lot=(await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send(input).expect(201)).body.data;
 assert.equal(lot.stock,5);assert.equal(Number(lot.costoUnitario),2.15);assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,8);
 await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send(input).expect(409);
 assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,8);
 const movements=(await request.get('/api/admin/inventario/movimientos?productoId='+created.id).set('Authorization',auth(adminToken)).expect(200)).body.data;
 assert.equal(movements.total,2);assert.ok(movements.items.some(row=>row.loteId===lot.id && row.cantidad===5 && row.tipo==='entrada'));
});
test('lotes y ajustes rechazan vencimientos imposibles, vencidos, cantidades negativas y saldos de otro producto',async()=> {
 const created=await product({stock:3}),other=await product({stock:1});
 const input={productoId:created.id,numero:'LOTE-VALIDAR',vencimiento:'2035-12-31',cantidad:2,costoUnitario:1,proveedorId:null};
 for(const patch of [{vencimiento:'2030-02-30'},{vencimiento:'2000-01-01'},{cantidad:0},{cantidad:2.1},{costoUnitario:1.234},{stock:7}])await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send({...input,...patch}).expect(422);
 const lot=(await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send(input).expect(201)).body.data;
 const adjust={productoId:created.id,loteId:lot.id,tipo:'salida',cantidad:3,motivo:'Salida sintética de prueba'};
 await request.post('/api/admin/inventario/ajustes').set('Authorization',auth(adminToken)).send(adjust).expect(409);
 await request.post('/api/admin/inventario/ajustes').set('Authorization',auth(adminToken)).send({...adjust,productoId:other.id,cantidad:1}).expect(422);
 await request.post('/api/admin/inventario/ajustes').set('Authorization',auth(adminToken)).send({...adjust,cantidad:1}).expect(201);
 assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,1);assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,4);
 await assert.rejects(()=>db.lote.update({where:{id:lot.id},data:{stock:-1}}));for(const vencimiento of ['2030-02-30','2030-13-01','2030-01-32'])await assert.rejects(()=>db.lote.update({where:{id:lot.id},data:{vencimiento}}));
});
test('FEFO reserva primero lotes próximos y cancelación devuelve exactamente los lotes originales una sola vez',async()=> {
 const created=await product({stock:2});
 const lots=[];for(const [numero,vencimiento,cantidad] of [['TARDIO','2035-12-31',4],['TEMPRANO','2034-01-31',2]])lots.push((await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send({productoId:created.id,numero,vencimiento,cantidad,costoUnitario:1,proveedorId:null}).expect(201)).body.data);
 const purchased=await order(created.id,5);
 assert.deepEqual(purchased.detalles[0].lotes.map(({loteId,cantidad})=>({loteId,cantidad})).sort((a,b)=>a.loteId.localeCompare(b.loteId)),[{loteId:lots[0].id,cantidad:3},{loteId:lots[1].id,cantidad:2}].sort((a,b)=>a.loteId.localeCompare(b.loteId)));
 assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,3);
 const cancelled=(await request.put('/api/pedidos/'+purchased.id+'/estado').set('Authorization',auth(adminToken)).send({estado:'cancelado',esperadoUpdatedAt:purchased.updatedAt}).expect(200)).body.data;
 await request.put('/api/pedidos/'+purchased.id+'/estado').set('Authorization',auth(adminToken)).send({estado:'cancelado',esperadoUpdatedAt:cancelled.updatedAt}).expect(200);
 assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,8);
 assert.equal((await db.lote.findUnique({where:{id:lots[0].id}})).stock,4);assert.equal((await db.lote.findUnique({where:{id:lots[1].id}})).stock,2);
 assert.equal(await db.movimientoInventario.count({where:{pedidoId:purchased.id,tipo:'devolucion'}}),2);
});
test('stock de lotes vencidos se excluye del catálogo y venta manteniendo inventario físico',async()=> {
 const created=await product({stock:1});await db.producto.update({where:{id:created.id},data:{stock:5}});
 const lot=await db.lote.create({data:{productoId:created.id,numero:'VENCIDO-SINTETICO',vencimiento:'2000-01-01',stock:4,costoUnitario:1}});
 const priced=(await request.get('/api/productos/'+created.id).expect(200)).body.data;assert.equal(priced.stock,1);
 await request.post('/api/pedidos').set('Authorization',auth(userToken)).send({carrito:[{productoId:created.id,cantidad:2}],comprador:buyer,claveSolicitud:randomUUID()}).expect(409);
 const bought=await order(created.id);assert.equal(bought.detalles[0].lotes.length,0);assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,4);
 const raw=(await request.get('/api/admin/tablas?tabla=productos').set('Authorization',auth(adminToken)).expect(200)).body.data.items.find(row=>row.id===created.id);assert.equal(raw.stock,4);
 await request.post('/api/admin/inventario/ajustes').set('Authorization',auth(adminToken)).send({productoId:created.id,loteId:lot.id,tipo:'entrada',cantidad:1,motivo:'Ingreso indebido de lote vencido'}).expect(422);
});
test('edición de stock sólo ajusta saldo sin lote y baja lógica preserva inventario físico',async()=> {
 const created=await product({stock:3});const lot=(await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send({productoId:created.id,numero:'LOTE-STOCK',vencimiento:'2035-12-31',cantidad:5,costoUnitario:1,proveedorId:null}).expect(201)).body.data;
 const current=await db.producto.findUnique({where:{id:created.id}});
 await request.put('/api/productos/'+created.id).set('Authorization',auth(adminToken)).send({...productInput,stock:4,esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(409);
 await request.put('/api/productos/'+created.id).set('Authorization',auth(adminToken)).send({...productInput,stock:6,esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(200);
 assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,5);
 await request.delete('/api/productos/'+created.id).set('Authorization',auth(adminToken)).expect(204);assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,6);
});
test('fecha de vencimiento respeta el día Ecuador hasta 23:59 sin depender de zona del servidor',()=> {
 const product={stock:5,lotes:[{stock:4,vencimiento:'2030-01-01'}]};
 assert.equal(inventory.ecuadorDay(new Date('2030-01-02T04:59:59Z')),'2030-01-01');assert.equal(inventory.sellableStock(product,new Date('2030-01-02T04:59:59Z')),5);assert.equal(inventory.sellableStock(product,new Date('2030-01-02T05:00:00Z')),1);
});
test('base de datos rechaza precios, existencias y snapshots fiscales inconsistentes',async()=> {
 const created=await product();
 for(const data of [{stock:-1},{precio:1.234},{ivaCategoria:'turismo'},{tipoProducto:'inventado'},{stockMinimo:-1}])await assert.rejects(()=>db.producto.update({where:{id:created.id},data}));
 await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "Producto" SET "stock"=? WHERE "id"=?',2.5,created.id));
 const purchased=await order(created.id);
 await assert.rejects(()=>db.pedido.update({where:{id:purchased.id},data:{ivaMonto:10}}));
 await assert.rejects(()=>db.pedidoDetalle.update({where:{id:purchased.detalles[0].id},data:{totalLinea:0}}));
 assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'),[]);
});
test('concurrencia reserva una única unidad por lote y BD rechaza stock físico menor que sus lotes',async()=> {
 const created=await product({stock:0});
 const lot=(await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send({productoId:created.id,numero:'UNICA-UNIDAD',vencimiento:'2035-12-31',cantidad:1,costoUnitario:1,proveedorId:null}).expect(201)).body.data;
 await assert.rejects(()=>db.producto.update({where:{id:created.id},data:{stock:0}}));
 await assert.rejects(()=>db.lote.update({where:{id:lot.id},data:{stock:2}}));
 const results=await Promise.all([1,2].map(()=>request.post('/api/pedidos').set('Authorization',auth(userToken)).send({carrito:[{productoId:created.id,cantidad:1}],comprador:buyer,claveSolicitud:randomUUID()})));
 assert.equal(results.filter(response=>response.status===201).length,1);assert.equal(results.filter(response=>response.status===409).length,1);
 for(const response of results)if(response.status===201)orderIds.push(response.body.data.id);
 assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,0);assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,0);
 assert.equal(await db.movimientoInventario.count({where:{productoId:created.id,tipo:'venta'}}),1);
});
test('un lote vencido después de la reserva impide avanzar la dispensación y permite cancelar con trazabilidad',async()=> {
 const created=await product({stock:0});const lot=(await request.post('/api/admin/lotes').set('Authorization',auth(adminToken)).send({productoId:created.id,numero:'VENCE-TRAS-RESERVA',vencimiento:'2035-12-31',cantidad:1,costoUnitario:1,proveedorId:null}).expect(201)).body.data;
 const purchased=await order(created.id);
 // Advance the fixture's effective expiration without changing the machine clock.
 await db.lote.update({where:{id:lot.id},data:{vencimiento:'2000-01-01'}});
 const blocked=await request.put('/api/pedidos/'+purchased.id+'/estado').set('Authorization',auth(adminToken)).send({estado:'confirmado',esperadoUpdatedAt:purchased.updatedAt}).expect(409);assert.equal(blocked.body.error.code,'LOT_EXPIRED_ORDER');
 await request.put('/api/pedidos/'+purchased.id+'/estado').set('Authorization',auth(adminToken)).send({estado:'cancelado',esperadoUpdatedAt:purchased.updatedAt}).expect(200);
 assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,1);assert.equal((await request.get('/api/productos/'+created.id).expect(200)).body.data.stock,0);
});
test('facturas emitidas o en proceso impiden cancelar y devolver stock; un borrador sin emitir permite cancelar',async()=> {
 for(const state of ['procesando','autorizada','borrador']) {
  const created=await product({stock:2}),purchased=await order(created.id),key=String(productIds.length).padStart(49,'0');
  const data={pedidoId:purchased.id,estado:'BORRADOR',ambiente:'1',emisorRuc:'0102030400001',establecimiento:'001',puntoEmision:'001',snapshot:'{}',xmlBorrador:'<factura/>'};
  if(state==='procesando')data.procesandoHasta=new Date(Date.now()+60000);
  if(state==='autorizada')Object.assign(data,{estado:'AUTORIZADA',secuencial:productIds.length,claveAcceso:key,fechaEmision:new Date(),xmlFirmado:'<factura/>',xmlAutorizado:'<factura/>',numeroAutorizacion:key,fechaAutorizacion:new Date()});
  await db.facturaPedido.create({data});
  const response=await request.put('/api/pedidos/'+purchased.id+'/estado').set('Authorization',auth(adminToken)).send({estado:'cancelado',esperadoUpdatedAt:purchased.updatedAt}).expect(state==='borrador'?200:409);
  if(state!=='borrador')assert.equal(response.body.error.code,'INVOICE_REQUIRES_RECONCILIATION');
  assert.equal((await db.producto.findUnique({where:{id:created.id}})).stock,state==='borrador'?2:1);
 }
});
test('medicamento requiere ficha y PVP impreso; API y BD impiden superar PVP sin modificar históricos',async()=> {
 const fields={tipoProducto:'medicamento',pvpMaximo:12,laboratorio:'Laboratorio sintético',presentacion:'Caja de prueba',registroSanitario:'Registro sintético no habilitante'};
 for(const field of ['pvpMaximo','laboratorio','presentacion','registroSanitario'])await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,...fields,[field]:null}).expect(422);
 for(const pvpMaximo of [0,-1,12.001,'12'])await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,...fields,pvpMaximo}).expect(422);
 const tooHigh=await request.post('/api/productos').set('Authorization',auth(adminToken)).send({...productInput,...fields,precio:12.01}).expect(422);assert.equal(tooHigh.body.error.code,'PRICE_EXCEEDS_PVP');
 const created=await product(fields),purchased=await order(created.id);
 assert.equal(Number(created.pvpMaximo),12);assert.equal(Number(purchased.detalles[0].precioOriginal),11.50);
 const current=await db.producto.findUnique({where:{id:created.id}});
 await request.put('/api/productos/'+created.id).set('Authorization',auth(adminToken)).send({...productInput,...fields,stock:current.stock,precio:12.01,esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(422);
 for(const sql of ['UPDATE "Producto" SET "precio"=12.01 WHERE "id"=?','UPDATE "Producto" SET "pvpMaximo"=NULL WHERE "id"=?','UPDATE "Producto" SET "registroSanitario"=NULL WHERE "id"=?','UPDATE "Producto" SET "laboratorio"=NULL WHERE "id"=?','UPDATE "Producto" SET "presentacion"=NULL WHERE "id"=?'])await assert.rejects(()=>db.$executeRawUnsafe(sql,created.id));
 for(const field of ['registroSanitario','laboratorio','presentacion'])await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "Producto" SET "'+field+'"=? WHERE "id"=?','   ',created.id));
 assert.equal(Number((await db.pedidoDetalle.findUnique({where:{id:purchased.detalles[0].id}})).precioOriginal),11.50);
 const legacy=await product({tipoProducto:'cuidado'});assert.equal(legacy.pvpMaximo,null);assert.equal(Number(legacy.precio),11.50);
});
after(async()=> {
 await db.facturaPedido.deleteMany({where:{pedidoId:{in:orderIds}}});
 await db.pedidoEstado.deleteMany({where:{pedidoId:{in:orderIds}}});await db.pedidoDetalle.deleteMany({where:{pedidoId:{in:orderIds}}});await db.pedido.deleteMany({where:{id:{in:orderIds}}});
 await db.movimientoInventario.deleteMany({where:{productoId:{in:productIds}}});await db.lote.deleteMany({where:{productoId:{in:productIds}}});await db.promocion.deleteMany({where:{productoId:{in:productIds}}});await db.producto.deleteMany({where:{id:{in:productIds}}});await db.proveedor.deleteMany({where:{id:{in:supplierIds}}});await db.configuracionFiscal.deleteMany({where:{id:{in:fiscalIds}}});
 await db.$disconnect();const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));await fs.rm(directory,{recursive:true,force:true});
});
