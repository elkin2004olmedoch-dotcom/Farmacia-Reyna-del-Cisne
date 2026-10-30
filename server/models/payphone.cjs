'use strict';
const {AppError}=require('../middleware/errors.cjs');
const API='https://pay.payphonetodoesposible.com/api/button/';
function httpsOrigin(value) {
 try {const url=new URL(value);return url.protocol==='https:' && url.origin===value && !url.username && !url.password && !url.search && !url.hash ? value : null;}catch{return null;}
}
function configuration() {
 const env=process.env,publicOrigin=httpsOrigin(env.PAYMENT_PUBLIC_ORIGIN),apiOrigin=httpsOrigin(env.PAYMENT_API_ORIGIN);
 const environment=env.PAYPHONE_ENVIRONMENT || 'sandbox';
 const allowed=(env.CORS_ORIGIN || '').split(',').map(value=>value.trim());
 const available=env.PAYPHONE_ENABLED==='true' && ['sandbox','production'].includes(environment) && Boolean(env.PAYPHONE_TOKEN && env.PAYPHONE_TOKEN.length<=4096 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.PAYPHONE_STORE_ID || '') && publicOrigin && apiOrigin && allowed.includes(publicOrigin));
 return {available,environment,publicOrigin,apiOrigin,token:env.PAYPHONE_TOKEN,storeId:env.PAYPHONE_STORE_ID};
}
function publicConfiguration() {const config=configuration();return {payphone:{disponible:config.available,entorno:config.available?config.environment:null},demostracion:true,moneda:'USD'};}
function requireAvailable() {const config=configuration();if(!config.available)throw new AppError(503,'PAYMENT_UNAVAILABLE','El pago en línea todavía no está habilitado. Coordina el pago con la farmacia.');return config;}
function storefront(pedidoId) {
 const {publicOrigin}=configuration();if(!publicOrigin)throw new AppError(503,'PAYMENT_UNAVAILABLE','El pago en línea todavía no está habilitado.');
 const url=new URL('/pagos.html',publicOrigin);if(pedidoId)url.searchParams.set('pedido',pedidoId);return url.href;
}
function hostedUrl(value,paymentId) {
 try {const url=new URL(value);return url.protocol==='https:' && url.origin==='https://pay.payphonetodoesposible.com' && !url.username && !url.password && url.pathname==='/Anonymous/Index' && !url.hash && [...url.searchParams.keys()].length===1 && url.searchParams.get('paymentId')===String(paymentId)?url.href:null;}catch{return null;}
}
async function post(operation,body,config) {
 const response=await fetch(API+operation,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('PAYPHONE_RESPONSE');
 const text=await response.text();if(Buffer.byteLength(text)>32768)throw new Error('PAYPHONE_RESPONSE');
 const value=JSON.parse(text);if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('PAYPHONE_RESPONSE');return value;
}
module.exports={configuration,publicConfiguration,requireAvailable,storefront,hostedUrl,post};
