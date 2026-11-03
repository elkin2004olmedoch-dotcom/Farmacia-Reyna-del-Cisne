'use strict';
const {randomUUID,createHash}=require('node:crypto');
const template=require('./email-template.cjs');
const {validEmail}=require('../../frontend/models/ecuador.js');
const ENDPOINT='https://api.resend.com/emails';
const TOKEN=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const escape=template.escape;
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
  const provider=env.EMAIL_PROVIDER||'resend';
  if(!['resend','brevo'].includes(provider))throw new Error('EMAIL_PROVIDER debe ser resend o brevo.');
  const apiKey=provider==='brevo'?env.BREVO_API_KEY:env.RESEND_API_KEY;
  if(!(provider==='brevo'?/^xkeysib-[A-Za-z0-9_-]{20,450}$/:/^re_[A-Za-z0-9_-]{8,250}$/).test(apiKey||''))throw new Error('Configura la clave privada del proveedor de correo.');
  if(!mailbox(env.EMAIL_FROM))throw new Error('EMAIL_FROM debe ser un correo de remitente válido, sin nombre ni cabeceras.');
  return {enabled:true,publicOrigin,apiKey,from:env.EMAIL_FROM,provider};
}
function confirmationUrl(origin,token){
  if(!TOKEN.test(token || ''))throw new Error('EMAIL_VERIFICATION_INPUT');
  const url=new URL('/confirmar-correo',origin);url.hash='token='+token;return url.href;
}
function message({to,name,token,config,expiresAt}){
  if(!config?.enabled || !mailbox(to) || !mailbox(config.from))throw new Error('EMAIL_VERIFICATION_INPUT');
  const link=confirmationUrl(config.publicOrigin,token),greeting=String(name || '').replace(/[\x00-\x1f]/g,' ').slice(0,80);
  const expiry=new Date(expiresAt||Date.now()+3600000);if(!Number.isFinite(expiry.getTime()))throw new Error('EMAIL_VERIFICATION_INPUT');
  const date=new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'long',timeStyle:'short',hour12:false}).format(expiry);
  const result={from:`Farmacia Reina del Cisne <${config.from}>`,to:[to],text:`Hola${greeting?', '+greeting:''}.\n\nConfirma tu correo para continuar con tu cuenta de Farmacia Reina del Cisne:\n${link}\n\nEste enlace caduca en una hora y sólo puede usarse una vez. Si no solicitaste esta cuenta, puedes ignorar este correo.\n\nFarmacia Reina del Cisne · Puerto Quito`};
  result.subject='Verifica tu correo | Farmacia Reina del Cisne';result.html=template.frame(config.publicOrigin,'Verifica tu correo',`<p>Hola${greeting?', '+escape(greeting):''}.</p><p>Confirma tu dirección de correo para terminar de configurar tu cuenta.</p>${template.button(link,'Verificar correo')}<p style="color:#6c625a">Este enlace se puede usar una sola vez y vence el ${escape(date)} (hora de Ecuador).</p><p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>`);result.text+=`\nVence el ${date} (hora de Ecuador).`;return result;
}
async function sendMessage(body,config,idempotencyKey,{fetch:send=globalThis.fetch}={}){
  try{
    const key=idempotencyKey || randomUUID();
    const brevo=config?.provider==='brevo';
    if(!config?.enabled || !mailbox(config.from) || !Array.isArray(body.to) || body.to.length!==1 || !mailbox(body.to[0]) || !/^[a-zA-Z0-9_-]{8,100}$/.test(key) || !(brevo?/^xkeysib-[A-Za-z0-9_-]{20,450}$/:/^re_[A-Za-z0-9_-]{8,250}$/).test(config.apiKey || ''))throw new Error('EMAIL_VERIFICATION_INPUT');
    const hash=createHash('sha256').update(key).digest('hex'),uuid=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const payloadBody=brevo?{sender:{email:config.from,name:'Farmacia Reina del Cisne'},to:body.to.map(email=>({email})),subject:body.subject,htmlContent:body.html,textContent:body.text,headers:{idempotencyKey:uuid},...(body.attachments?{attachment:body.attachments.map(item=>({name:item.filename,content:item.content}))}:{})}:{...body,from:`Farmacia Reina del Cisne <${config.from}>`};
    const response=await send(brevo?'https://api.brevo.com/v3/smtp/email':ENDPOINT,{method:'POST',headers:brevo?{'api-key':config.apiKey,'Content-Type':'application/json',Accept:'application/json'}:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json',Accept:'application/json','Idempotency-Key':key},body:JSON.stringify(payloadBody),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    const text=await response.text();if(Buffer.byteLength(text)>8192)throw new Error('EMAIL_DELIVERY_FAILED');
    const payload=JSON.parse(text);if(!response.ok){if(brevo&&response.status===400&&payload.code==='duplicate_parameter'&&/idempotenc/i.test(payload.message||''))return {accepted:true};throw new Error('EMAIL_DELIVERY_FAILED');}
    const id=brevo?payload.messageId:payload.id;if(typeof id!=='string' || !id || id.length>(brevo?250:100))throw new Error('EMAIL_DELIVERY_FAILED');
    return {accepted:true};
  }catch{throw Object.assign(new Error('No se pudo enviar el correo de confirmación. Intenta nuevamente.'),{code:'EMAIL_DELIVERY_FAILED'});}
}
async function sendVerification(values,options){
  try{return await sendMessage(message(values),values.config,values.idempotencyKey,options);}
  catch{throw Object.assign(new Error('No se pudo enviar el correo de confirmación. Intenta nuevamente.'),{code:'EMAIL_DELIVERY_FAILED'});}
}
module.exports={configuration,confirmationUrl,sendVerification,sendMessage};
