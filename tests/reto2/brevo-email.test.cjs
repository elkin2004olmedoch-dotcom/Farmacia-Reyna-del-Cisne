'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const mail=require('../../server/models/email-delivery.cjs');
const env={NODE_ENV:'production',EMAIL_VERIFICATION_ENABLED:'true',EMAIL_PROVIDER:'brevo',BREVO_API_KEY:'xkeysib-synthetic_not_real_1234567890123456',EMAIL_FROM:'farmacia@example.ec',EMAIL_PUBLIC_ORIGIN:'https://tienda.example.ec'};
const config=()=>mail.configuration(env,{production:true,origins:[env.EMAIL_PUBLIC_ORIGIN]});
test('Brevo usa HTTPS, remitente fijo, UUID estable y adjuntos; no envía claves en el contenido',async()=>{
 const calls=[],body={to:['cliente@example.ec'],subject:'Factura',html:'<p>Factura</p>',text:'Factura',attachments:[{filename:'factura.xml',content:Buffer.from('<factura/>').toString('base64')}]};
 for(let i=0;i<2;i++)assert.deepEqual(await mail.sendMessage(body,config(),'invoice-synthetic-key',{fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({messageId:'<synthetic-message>'}),{status:201});}}),{accepted:true});
 const {url,options}=calls[0],payload=JSON.parse(options.body);assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(options.headers['api-key'],env.BREVO_API_KEY);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.ok(options.signal instanceof AbortSignal);assert.deepEqual(payload.sender,{email:env.EMAIL_FROM,name:'Farmacia Reina del Cisne'});assert.deepEqual(payload.to,[{email:'cliente@example.ec'}]);assert.equal(payload.attachment[0].name,'factura.xml');assert.equal(payload.attachment[0].content,body.attachments[0].content);assert.match(payload.headers.idempotencyKey,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(JSON.parse(calls[1].options.body).headers.idempotencyKey,payload.headers.idempotencyKey);assert.ok(!options.body.includes(env.BREVO_API_KEY));
});
test('verificación muestra marca, botón, fecha de Ecuador y token únicamente en el enlace',async()=>{
 let payload;const token=Buffer.alloc(32,3).toString('base64url');await mail.sendVerification({to:'cliente@example.ec',name:'Ana <script>',token,config:config(),expiresAt:new Date('2026-11-03T03:00:00Z')},{fetch:async(url,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({messageId:'<synthetic>'}),{status:201});}});assert.match(payload.htmlContent,/Verifica tu correo/);assert.match(payload.htmlContent,/Verificar correo/);assert.match(payload.htmlContent,/logo-reina-del-cisne\.png/);assert.match(payload.htmlContent,/22:00/);assert.match(payload.htmlContent,/2 de noviembre de 2026/);assert.match(payload.htmlContent,/&lt;script&gt;/);assert.ok(payload.htmlContent.includes('/confirmar-correo#token='+token));assert.ok(!payload.htmlContent.includes('<script>'));
});
test('Brevo rechaza claves y remitentes inválidos sin revelar valores',()=>{
 for(const override of [{BREVO_API_KEY:''},{BREVO_API_KEY:'xkeysib-private\r\n'},{EMAIL_PROVIDER:'otro'},{EMAIL_FROM:'Nombre <correo@example.ec>'}])assert.throws(()=>mail.configuration({...env,...override},{production:true,origins:[env.EMAIL_PUBLIC_ORIGIN]}),error=>!error.message.includes(env.BREVO_API_KEY));
});
test('errores del proveedor permanecen privados; duplicado de idempotencia es aceptación previa',async()=>{
 const body={to:['cliente@example.ec'],subject:'Prueba',html:'<p>Prueba</p>'};await assert.rejects(mail.sendMessage(body,config(),'synthetic-key',{fetch:async()=>new Response(JSON.stringify({code:'unauthorized',message:env.BREVO_API_KEY}),{status:401})}),error=>error.code==='EMAIL_DELIVERY_FAILED'&&!error.message.includes(env.BREVO_API_KEY));
 assert.deepEqual(await mail.sendMessage(body,config(),'synthetic-key',{fetch:async()=>new Response(JSON.stringify({code:'duplicate_parameter',message:'Email for the idempotency key has already been processed'}),{status:400})}),{accepted:true});
});
