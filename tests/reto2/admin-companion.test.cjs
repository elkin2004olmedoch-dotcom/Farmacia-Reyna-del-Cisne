const test=require('node:test');
const assert=require('node:assert/strict');

test('interpreta una orden concreta para actualizar un producto existente',async()=>{
  const {interpretAdminCommand}=await import('../../frontend/controllers/admin-command.mjs');
  const product={id:'curitas-clasicas',nombre:'Curitas clásicas',precio:1.25,stock:8,updatedAt:'2026-10-01T12:00:00.000Z'};
  const result=interpretAdminCommand('Actualiza el precio de "Curitas clásicas" a $2,50 y el stock a 12',[product]);
  assert.equal(result.type,'update-product');
  assert.equal(result.product.id,product.id);
  assert.deepEqual(result.changes,{precio:2.5,stock:12});
});

test('pide los datos que faltan y no adivina producto o campos de actualización',async()=>{
  const {interpretAdminCommand}=await import('../../frontend/controllers/admin-command.mjs');
  const result=interpretAdminCommand('actualiza el producto Curitas clásicas', [{id:'curitas',nombre:'Curitas clásicas'}]);
  assert.equal(result.type,'needs-details');
  assert.match(result.message,/precio|stock|descuento/i);
});

test('prepara sólo una promoción explícita con producto, descuento y fecha final',async()=>{
  const {interpretAdminCommand}=await import('../../frontend/controllers/admin-command.mjs');
  const product={id:'curitas-clasicas',nombre:'Curitas clásicas'};
  const result=interpretAdminCommand('Publica una promoción de 20% para "Curitas clásicas" hasta 2026-12-31 titulada "Navidad"',[product]);
  assert.equal(result.type,'create-promotion');
  assert.equal(result.values.productoId,product.id);
  assert.equal(result.values.titulo,'Navidad');
  assert.equal(result.values.descuentoPorcentaje,20);
  assert.equal(result.values.activa,true);
  assert.equal(result.values.vistaPrevia,false);
  assert.equal(result.values.fin,'2027-01-01T04:59:59.999Z');
});

test('rechaza por seguridad porcentajes sobre el máximo y consultas fuera del panel',async()=>{
  const {interpretAdminCommand}=await import('../../frontend/controllers/admin-command.mjs');
  const product={id:'curitas-clasicas',nombre:'Curitas clásicas'};
  assert.equal(interpretAdminCommand('Publica promoción 95% para Curitas clásicas hasta 2026-12-31',[product]).type,'needs-details');
  const expired=interpretAdminCommand('Publica promoción 20% para Curitas clásicas hasta 2000-01-01',[product]);
  assert.equal(expired.type,'needs-details');
  assert.equal(interpretAdminCommand('Cuéntame un chiste',[product]).type,'off-topic');
});
