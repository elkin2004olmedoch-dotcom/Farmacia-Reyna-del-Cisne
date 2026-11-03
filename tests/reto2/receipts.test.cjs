const {test}=require('node:test');
const assert=require('node:assert/strict');
const order={id:'pedido-123',createdAt:'2026-11-02T02:30:00Z',estado:'pendiente',nombre:'Cliente Prueba',email:'cliente@example.ec',telefono:'+593990000000',documento:'••••••0400',entrega:'delivery',direccion:'Calle Principal 123',ciudad:'Puerto Quito',provincia:'Pichincha',codigoPostal:null,subtotalProductos:'11.50',baseImponible:'12.17',ivaMonto:'1.83',costoEnvioCentavos:250,total:'14.00',detalles:[{productoId:'producto-1',nombreProducto:'Cuidado personal',cantidad:2,precioUnitario:'5.75',totalLinea:'11.50'}]};

test('comprobante usa fecha de Ecuador, documento enmascarado e importes históricos del servidor',async()=>{
  const {orderReceiptView}=await import('../../frontend/views/receipts.js');const html=orderReceiptView(order);
  assert.match(html,/RC-pedido-123/);assert.match(html,/1 de noviembre de 2026/);assert.match(html,/21:30/);assert.match(html,/••••••0400/);assert.match(html,/\$14,00/);assert.match(html,/\$2,50/);assert.match(html,/\$12,17/);assert.match(html,/\$1,83/);assert.match(html,/producto-1/);
  assert.match(html,/sin validez tributaria/);assert.match(html,/No acredita un pago ni sustituye una factura autorizada por el SRI/);assert.doesNotMatch(html,/Demo|demostración|Autorización:|Clave de acceso:|Pagado/);
});

test('cada campo de texto se escapa y el comprobante no lee identificaciones privadas adicionales',async()=>{
  const {orderReceiptView}=await import('../../frontend/views/receipts.js');const text='<img src=x onerror="fallo()">';
  const html=orderReceiptView({...order,id:text,nombre:text,email:text,telefono:text,documento:'••••••0400',direccion:text,ciudad:text,provincia:text,cedula:'0102030400',document:'0102030400',detalles:[{...order.detalles[0],codigoInterno:text,nombreProducto:text}]});
  assert.doesNotMatch(html,/<img src=x|<script|0102030400/);assert.match(html,/&lt;img src=x onerror=&quot;fallo\(\)&quot;&gt;/);assert.match(html,/••••••0400/);
});

test('totales ausentes no se presentan como cero ni se recalculan con precios actuales',async()=>{
  const {orderReceiptView}=await import('../../frontend/views/receipts.js');
  const html=orderReceiptView({...order,subtotalProductos:null,baseImponible:null,ivaMonto:null,costoEnvioCentavos:null,total:'99.99',detalles:[{...order.detalles[0],precioUnitario:'1.00',totalLinea:'7.25'}]});
  assert.match(html,/\$99,99/);assert.match(html,/\$7,25/);assert.equal((html.match(/No disponible/g)||[]).length,4);assert.doesNotMatch(html,/\$0,00/);
});

test('estado cancelado y retiro se muestran sin afirmar un pago o inventar datos fiscales',async()=>{
  const {orderReceiptView}=await import('../../frontend/views/receipts.js');
  const html=orderReceiptView({...order,estado:'cancelado',entrega:'pickup',direccion:null,ciudad:null,provincia:null,costoEnvioCentavos:0});
  assert.match(html,/Cancelado/);assert.match(html,/Retiro en farmacia/);assert.match(html,/\$0,00/);assert.doesNotMatch(html,/Calle Principal|RUC del emisor|Factura electrónica|Número de autorización/);
});
