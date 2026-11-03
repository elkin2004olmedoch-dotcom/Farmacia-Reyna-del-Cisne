'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDocumentEmail}=require('../../server/models/document-email.cjs');
const config={emailVerification:{enabled:true,publicOrigin:'https://tienda.example.ec',from:'correo@example.ec',apiKey:'re_synthetic_not_real'}};
const order=()=>({id:'pedido-sintetico',userId:'usuario',nombre:'<script>mal</script>',email:'otro@example.ec',createdAt:new Date('2026-11-02T12:00:00Z'),estado:'pendiente',total:'11.50',subtotalProductos:'10',costoEnvioCentavos:150,baseImponible:'10',ivaMonto:'0',detalles:[{productoId:'producto',nombreProducto:'<img onerror=alert(1)>',cantidad:1,precioUnitario:'10',totalLinea:'10'}]});
function setup(user={id:'usuario',email:'registrado@example.ec',activo:true,emailVerifiedAt:new Date()}){const messages=[];const db={usuario:{findUnique:async()=>user},pedido:{findUnique:async()=>order()}};const service=createDocumentEmail({db,send:async(...args)=>{messages.push(args);return {accepted:true};}});return {db,service,messages};}
test('comprobante usa sólo correo verificado de la cuenta, adjunto HTML, envío y totales guardados y escape XSS',async()=>{
 const {service,messages}=setup();assert.deepEqual(await service.receipt(order(),config),{status:'accepted'});const [body,,key]=messages[0];assert.deepEqual(body.to,['registrado@example.ec']);assert.match(key,/^[a-f0-9]{64}$/);const html=Buffer.from(body.attachments[0].content,'base64').toString();assert.ok(html.includes('1,50'));assert.ok(html.includes('11,50'));assert.ok(html.includes('https://tienda.example.ec/assets/images/logo'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.match(html,/sin validez tributaria/);assert.match(body.attachments[0].filename,/\.html$/);
});
test('desactivado no consulta ni envía; correo no verificado e inactivo no reciben documentos',async()=>{
 const disabled=createDocumentEmail({db:{usuario:{findUnique(){throw Error('No debe consultar');}}},send(){throw Error('No debe enviar');}});assert.deepEqual(await disabled.receipt(order(),{}),{status:'disabled'});
 for(const user of [{activo:true,emailVerifiedAt:null},{activo:false,emailVerifiedAt:new Date()},null]){const {service,messages}=setup(user);assert.deepEqual(await service.receipt(order(),config),{status:'verification_required'});assert.equal(messages.length,0);}
});
test('fallos de proveedor y BD no lanzan errores ni exponen información y permiten volver a solicitar',async()=>{
 const {db}=setup();let tries=0;const service=createDocumentEmail({db,send:async()=>{if(++tries===1)throw Error('privado');}});assert.deepEqual(await service.receipt(order(),config),{status:'unavailable'});assert.deepEqual(await service.receipt(order(),config),{status:'accepted'});
 db.usuario.findUnique=async()=>{throw Error('privado');};assert.deepEqual(await service.receipt(order(),config),{status:'unavailable'});
});
test('idempotencia es estable por contenido; un documento actualizado recibe otra clave',async()=>{
 const {service,messages}=setup();await service.receipt(order(),config);await service.receipt(order(),config);assert.equal(messages[0][2],messages[1][2]);await service.receipt({...order(),estado:'confirmado'},config);assert.notEqual(messages[0][2],messages[2][2]);
});
test('reenvío rechaza otros propietarios incluso administrador, sin enviar',async()=>{
 const {service,messages}=setup();for(const role of ['user','admin'])await assert.rejects(()=>service.resend('pedido',{id:'ajeno',role},config),e=>e.status===404);assert.equal(messages.length,0);
});
test('factura sólo autorizada, adjunta XML y RIDE con permisos del propietario y conserva marca de ambiente',async()=>{
 const {service,messages}=setup();const invoice={id:'factura',pedidoId:order().id,estado:'AUTORIZADA'};const billing={download:async(id,actor)=>{assert.deepEqual(actor,{id:'usuario',role:'user'});return {xml:'<autorizacion>PRUEBAS</autorizacion>'};},ride:async()=>'<html>PRUEBAS</html>'};assert.deepEqual(await service.invoice({...invoice,estado:'BORRADOR'},billing,config),{status:'not_authorized'});assert.equal(messages.length,0);assert.deepEqual(await service.invoice(invoice,billing,config),{status:'accepted'});assert.equal(Buffer.from(messages[0][0].attachments[0].content,'base64').toString(),'<autorizacion>PRUEBAS</autorizacion>');assert.equal(Buffer.from(messages[0][0].attachments[1].content,'base64').toString(),'<html>PRUEBAS</html>');
});
test('controlador envía después de guardar, conserva respuesta exitosa con correo fallido y no envía en replay',async()=>{
 const orders=require('../../server/models/pedidos.cjs'),documents=require('../../server/models/document-email.cjs'),oldCreate=orders.create,oldFactory=documents.createDocumentEmail;let committed=false,sends=0,replayed=false;
 try{orders.create=async()=>{committed=true;return {pedido:order(),replayed};};documents.createDocumentEmail=()=>({receipt:async()=>{assert.equal(committed,true);sends++;return {status:'unavailable'};}});const controller=require('../../server/controllers/pedidos.cjs')(config),res={status(code){this.code=code;return this;},json(body){this.body=body;}};await controller.create({user:{id:'usuario'},input:{}},res);assert.equal(res.code,201);assert.equal(res.body.email.status,'unavailable');replayed=true;await controller.create({user:{id:'usuario'},input:{}},res);assert.equal(res.code,200);assert.equal(sends,1);}
 finally{orders.create=oldCreate;documents.createDocumentEmail=oldFactory;}
});
