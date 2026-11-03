'use strict';
const {randomUUID}=require('node:crypto');
const {validEmail}=require('../../frontend/models/ecuador.js');
const ENDPOINT='https://api.resend.com/emails';
const TOKEN=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const mailbox=value=>typeof value==='string' && value===value.trim() && validEmail(value) && !/[\s,;()"\\\x00-\x1f]/.test(value);
function configuration(env,{production=false,origins=[]}={}){
  const flag=env.EMAIL_VERIFICATION_ENABLED || 'false';
  if(!['true','false'].includes(flag))throw new Error('EMAIL_VERIFICATION_ENABLED debe ser true o false.');
  if(flag==='false')return {enabled:false,publicOrigin:null,apiKey:null,from:null};
  const publicOrigin=env.EMAIL_PUBLIC_ORIGIN || '';let url;
  try{url=new URL(publicOrigin);}catch{}
  const loopback=url && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const testLoopback=env.NODE_ENV==='test' && !production && loopback;
  if(!url || url.origin!==publicOrigin || url.username || url.password || url.search || url.hash || publicOrigin.includes('*') || loopback && !testLoopback || url.protocol!=='https:' && !(testLoopback && url.protocol==='http:') || !origins.includes(publicOrigin))throw new Error('EMAIL_PUBLIC_ORIGIN debe ser un origen HTTPS exacto autorizado en CORS_ORIGIN; HTTP local se permite sólo en pruebas.');
  if(!/^re_[A-Za-z0-9_-]{8,250}$/.test(env.RESEND_API_KEY || ''))throw new Error('Configura RESEND_API_KEY para confirmar correos.');
  if(!mailbox(env.EMAIL_FROM))throw new Error('EMAIL_FROM debe ser un correo de remitente válido, sin nombre ni cabeceras.');
  return {enabled:true,publicOrigin,apiKey:env.RESEND_API_KEY,from:env.EMAIL_FROM};
}
function confirmationUrl(origin,token){
  if(!TOKEN.test(token || ''))throw new Error('EMAIL_VERIFICATION_INPUT');
  const url=new URL('/confirmar-correo',origin);url.hash='token='+token;return url.href;
}
function message({to,name,token,config}){
  if(!config?.enabled || !mailbox(to) || !mailbox(config.from))throw new Error('EMAIL_VERIFICATION_INPUT');
  const link=confirmationUrl(config.publicOrigin,token),greeting=String(name || '').replace(/[\x00-\x1f]/g,' ').slice(0,80);
  return {from:`Farmacia Reina del Cisne <${config.from}>`,to:[to],subject:'Confirma tu correo | Farmacia Reina del Cisne',text:`Hola${greeting?', '+greeting:''}.\n\nConfirma tu correo para continuar con tu cuenta de Farmacia Reina del Cisne:\n${link}\n\nEste enlace caduca en una hora y sólo puede usarse una vez. Si no solicitaste esta cuenta, puedes ignorar este correo.\n\nFarmacia Reina del Cisne · Puerto Quito`,html:`<!doctype html><html lang="es"><body style="margin:0;padding:32px 20px;background:#f8f4eb;color:#30241f;font:16px/1.7 Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:28px;background:#fffefa;border:1px solid #e3dcd1;border-radius:12px"><p style="color:#8e1c32;font-weight:bold">Farmacia Reina del Cisne</p><h1 style="font-size:26px;line-height:1.3">Confirma tu correo</h1><p>Hola${greeting?', '+escape(greeting):''}.</p><p>Confirma tu correo para continuar con tu cuenta.</p><p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;padding:12px 22px;border-radius:6px;background:#981e36;color:#fff;text-decoration:none;font-weight:bold">Confirmar mi correo</a></p><p>Este enlace caduca en una hora y sólo puede usarse una vez.</p><p style="font-size:13px;color:#6c625a">Si no solicitaste esta cuenta, puedes ignorar este correo.</p><p style="font-size:13px;color:#6c625a">Farmacia Reina del Cisne · Puerto Quito</p></div></body></html>`};
}
async function sendMessage(body,config,idempotencyKey,{fetch:send=globalThis.fetch}={}){
  try{
    const key=idempotencyKey || randomUUID();
    if(!config?.enabled || !mailbox(config.from) || !Array.isArray(body.to) || body.to.length!==1 || !mailbox(body.to[0]) || !/^[a-zA-Z0-9_-]{8,100}$/.test(key) || !/^re_[A-Za-z0-9_-]{8,250}$/.test(config.apiKey || ''))throw new Error('EMAIL_VERIFICATION_INPUT');
    const response=await send(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json',Accept:'application/json','Idempotency-Key':key},body:JSON.stringify({...body,from:`Farmacia Reina del Cisne <${config.from}>`}),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok){await response.body?.cancel();throw new Error('EMAIL_DELIVERY_FAILED');}
    const text=await response.text();if(Buffer.byteLength(text)>8192)throw new Error('EMAIL_DELIVERY_FAILED');
    const payload=JSON.parse(text);if(!payload || typeof payload.id!=='string' || !payload.id || payload.id.length>100)throw new Error('EMAIL_DELIVERY_FAILED');
    return {accepted:true};
  }catch{throw Object.assign(new Error('No se pudo enviar el correo de confirmación. Intenta nuevamente.'),{code:'EMAIL_DELIVERY_FAILED'});}
}
async function sendVerification(values,options){
  try{return await sendMessage(message(values),values.config,values.idempotencyKey,options);}
  catch{throw Object.assign(new Error('No se pudo enviar el correo de confirmación. Intenta nuevamente.'),{code:'EMAIL_DELIVERY_FAILED'});}
}
module.exports={configuration,confirmationUrl,sendVerification,sendMessage};
