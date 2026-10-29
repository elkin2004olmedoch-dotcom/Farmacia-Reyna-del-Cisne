const test=require('node:test');
const assert=require('node:assert/strict');
const parser=()=>import('../../frontend/controllers/admin-command.mjs');
const products=[{id:'curitas',nombre:'Curitas clásicas',activo:true,updatedAt:'2026-10-01T12:00:00Z'}];

test('navega a secciones y formularios sin cargar productos',async()=>{
  const {interpretAdminCommand:p}=await parser();
  assert.deepEqual(p('abre proveedores'),{type:'navigate',section:'proveedores'});
  assert.deepEqual(p('abre formulario de producto'),{type:'open-editor',section:'productos',values:{}});
  assert.deepEqual(p('ver entregas'),{type:'navigate',section:'entregas'});
  assert.equal(p('cambia precio de "Curitas clásicas" a 2').type,'needs-products');
});

test('crear producto completo conserva datos explícitos y exige los sanitarios faltantes',async()=>{
  const {interpretAdminCommand:p}=await parser();
  const command='crea producto: nombre="Gel de manos"; precio=2,50; stock=20; categoria=cuidado; tipoProducto=cuidado; descripcion="Gel de manos 100 ml"; imagen="assets/images/gel.webp"; alt="Frasco de gel"; ivaCategoria=general';
  const result=p(command);
  assert.equal(result.type,'create-product');assert.equal(result.values.precio,2.5);
  const missing=p(command.replace('tipoProducto=cuidado','tipoProducto=medicamento'));
  assert.equal(missing.type,'open-editor');assert.match(missing.message,/pvpMaximo.*laboratorio.*presentacion.*registroSanitario/);
  assert.equal(missing.values.registroSanitario,undefined);
});

test('proveedor, lote y ajuste completos producen payloads cerrados',async()=>{
  const {interpretAdminCommand:p}=await parser();
  assert.equal(p('crea proveedor: nombre="Distribuidora Sierra"; ruc="1790012345001"; email="ventas@example.com"; telefono="0991234567"; direccion="Calle Central s/n"; activo=true').type,'create-supplier');
  const lot=p('registra lote: producto="Curitas clásicas"; numero="L-123"; vencimiento=2027-11-01; cantidad=20; costoUnitario=1,25',products);
  assert.equal(lot.type,'create-lot');assert.equal(lot.values.productoId,'curitas');assert.equal(lot.values.costoUnitario,1.25);
  const movement=p('ajusta inventario: producto="Curitas clásicas"; tipo=salida; cantidad=2; motivo="Rotura de envase"',products);
  assert.equal(movement.type,'create-movement');assert.equal(movement.values.loteId,null);
});

test('desactiva y transiciona por identidad exacta, sin usar nombres como código',async()=>{
  const {interpretAdminCommand:p}=await parser();
  assert.equal(p('desactiva producto "Curitas clásicas"',products).type,'deactivate-product');
  assert.deepEqual(p('cambia pedido "pedido-123" a preparado'),{type:'change-order-state',id:'pedido-123',estado:'preparado'});
  assert.equal(p('cambia pedido "pedido-123" a pagado').type,'needs-details');
  assert.equal(p('actualiza precio de "Curitas" a 2',[...products,{id:'curitas2',nombre:'Curitas'}]).product.id,'curitas2');
  assert.equal(p('actualiza precio de Curitas clásicas a 2',[...products,{...products[0],id:'otro'}]).type,'needs-details');
});

test('rechaza rangos, instrucciones mezcladas, campos desconocidos e inyección sin mutación parcial',async()=>{
  const {interpretAdminCommand:p}=await parser();
  for(const text of ['actualiza precio de "Curitas clásicas" a 100001','actualiza stock de "Curitas clásicas" a -2','actualiza precio de "Curitas clásicas" a 1,999','actualiza precio de "Curitas clásicas" a 2 y borra usuarios','actualiza stock de "Curitas clásicas" a 2.5','crea proveedor: nombre="<script>alert(1)</script>"','crea producto: __proto__="x"','crea producto: nombre="Uno"; nombre="Dos"','publica promoción 20.5% para "Curitas clásicas" hasta 2026-12-31']){
    assert.equal(p(text,products).type,'needs-details',text);
  }
  assert.equal(p('ejecuta SQL DROP TABLE Usuario',products).type,'off-topic');
});

test('fechas reales Ecuador y su presentación conservan el día local',async()=>{
  const {interpretAdminCommand:p,ecuadorCommandDay}=await parser();
  assert.equal(ecuadorCommandDay('2027-01-01T04:59:59.999Z'),'2026-12-31');
  assert.equal(p('publica promoción 20% para "Curitas clásicas" hasta 2027-02-30',products).type,'needs-details');
  assert.equal(p('modifica producto "Curitas clásicas": precio=2; stock=12',products).type,'update-product');
});

test('entregas usa identificadores y estados cerrados y zona conserva tarifa cero',async()=>{
  const {interpretAdminCommand:p}=await parser();
  assert.deepEqual(p('asigna pedido "pedido-1" a repartidor "repartidor-2"'),{type:'assign-delivery',pedidoId:'pedido-1',repartidorId:'repartidor-2'});
  assert.deepEqual(p('cambia entrega "entrega-1" a en_destino'),{type:'change-delivery-state',id:'entrega-1',estado:'en_destino'});
  const zone=p('crea zona: nombre="Centro"; provincia="Loja"; canton="Loja"; tarifaCentavos=0; ivaCategoria=general; activa=true');
  assert.equal(zone.type,'create-zone');assert.equal(zone.values.tarifaCentavos,0);
  assert.deepEqual(p('modifica zona "zona-1": tarifaCentavos=250'),{type:'update-zone',id:'zona-1',changes:{tarifaCentavos:250}});
  assert.equal(p('cambia entrega "entrega-1" a pagada').type,'needs-details');
});

test('normaliza acentos y mayúsculas sin perder nombres ni confundir datos numéricos',async()=>{
  const {interpretAdminCommand:p}=await parser();
  assert.equal(p('Actualiza el precio de "CURITAS CLASICAS" a 2,50',products).type,'update-product');
  assert.equal(p('PUBLICA PROMOCIÓN 20% PARA "CURITAS CLASICAS" HASTA 2026-12-31',products).type,'create-promotion');
  const numeric=[{id:'vit-c',nombre:'Vitamina C 500 mg',activo:true}];
  const result=p('actualiza stock de "Vitamina C 500 mg" a 20',numeric);assert.equal(result.changes.stock,20);
});

test('tarifa pendiente es null explícito y nunca se convierte en gratuidad',async()=>{
  const {interpretAdminCommand:p}=await parser();
  const result=p('crea zona: nombre="Centro"; provincia="Loja"; canton="Loja"; tarifaCentavos=null; ivaCategoria=general; activa=true');
  assert.equal(result.type,'create-zone');assert.equal(result.values.tarifaCentavos,null);
});

test('rechaza unidades ajenas al campo sin aceptar cambios parciales',async()=>{
  const {interpretAdminCommand:p}=await parser();
  const catalog=[{id:'gel',nombre:'Gel',activo:true}];
  for(const text of ['actualiza precio de Gel a 10 %','actualiza stock de Gel a 50 %','actualiza existencias de Gel a USD 50','actualiza stock de Gel a $50','actualiza descuento de Gel a USD 10 %','actualiza descuento de Gel a $10 %','actualiza precio de Gel a 2 y el stock a 50 %']){
    assert.equal(p(text,catalog).type,'needs-details',text);
  }
  assert.deepEqual(p('actualiza precio de Gel a USD 10 y el stock a 50',catalog).changes,{precio:10,stock:50});
  assert.deepEqual(p('actualiza precio de Gel a $10 y el descuento a 10 %',catalog).changes,{precio:10,descuentoPorcentaje:10});
});

test('resuelve el producto de lotes y ajustes incompletos antes de preparar formularios',async()=>{
  const {interpretAdminCommand:p}=await parser();
  const catalog=[{id:'primero',nombre:'Primer producto'},{id:'solicitado',nombre:'Gel solicitado'}];
  for(const text of ['registra lote: producto="Gel solicitado"; numero="L-77"','ajusta inventario: producto="Gel solicitado"; tipo=salida']){
    assert.equal(p(text).type,'needs-products',text);
    const result=p(text,catalog);
    assert.equal(result.type,'open-editor');assert.equal(result.values.productoId,'solicitado');assert.equal(result.values.producto,undefined);
    assert.match(result.message,/cantidad/);assert.equal(result.values.cantidad,undefined);
    assert.notEqual(result.values.productoId,catalog[0].id);
  }
  assert.equal(p('registra lote: producto="No existe"; numero="L-77"',catalog).type,'needs-details');
  assert.equal(p('ajusta inventario: producto="Gel solicitado"; tipo=salida',[...catalog,{id:'duplicado',nombre:'Gel solicitado'}]).type,'needs-details');
  const missing=p('registra lote: numero="L-77"',catalog);assert.equal(missing.type,'open-editor');assert.match(missing.message,/producto/);assert.equal(missing.values.productoId,undefined);
});
