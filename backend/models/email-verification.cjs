'use strict';
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const delivery=require('./email-delivery.cjs');
const diagnostics=require('../diagnostics.cjs');
const {AppError}=require('../middleware/errors.cjs');
const TTL_MS=3600000,COOLDOWN_MS=60000;
const TOKEN=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const userSelect={id:true,nombre:true,email:true,role:true,activo:true,emailVerifiedAt:true,emailVerificationRequired:true};
const requiresVerification=(user,force=false)=>Boolean(user&&(user.emailVerificationRequired===true||force)&&!user.emailVerifiedAt);
const invalid=()=>new AppError(422,'EMAIL_VERIFICATION_INVALID','El enlace de confirmación no es válido o ya venció. Solicita uno nuevo.');
function createEmailVerification({db,deliver=values=>delivery.sendVerification(values),now=()=>new Date(),random=randomBytes,emit=outcome=>diagnostics.emit('email_verification',{outcome})}={}){
  const client=()=>db || require('./db.cjs');
  const record=outcome=>{try{emit(outcome);}catch{/* Metrics never change the verification outcome. */}};
  async function transaction(action){
    for(let attempt=0;attempt<3;attempt++)try{return await client().$transaction(action,{isolationLevel:'Serializable',maxWait:5000,timeout:10000});}
    catch(error){if(['P2002','P2034','P2028','P1008'].includes(error.code) && attempt<2)continue;throw error;}
  }
  async function issue(user,settings){
    const resolved=settings||require('../config.cjs')();
    const force=resolved.requireVerifiedRegistration===true&&user?.role==='user';
    if(!requiresVerification(user,force))return {status:'not-required'};
    const config=resolved.emailVerification;
    if(!config?.enabled)return {status:'disabled'};
    const token=random(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex');
    if(!TOKEN.test(token))throw new Error('EMAIL_VERIFICATION_RANDOM');
    let claimed;
    try{
      claimed=await transaction(async tx=>{
        const current=await tx.usuario.findUnique({where:{id:user.id},select:userSelect});
        if(!current?.activo || !requiresVerification(current,force&&current.role==='user'))return {status:'not-required'};
        const createdAt=new Date(now()),cutoff=new Date(createdAt.getTime()-COOLDOWN_MS),expiresAt=new Date(createdAt.getTime()+TTL_MS);
        const existing=await tx.emailVerification.findUnique({where:{usuarioId:current.id},select:{createdAt:true}});
        if(existing && existing.createdAt>cutoff)return {status:'cooldown'};
        const data={email:current.email,tokenHash,expiresAt,createdAt};
        if(current.emailVerificationRequired!==true){const changed=await tx.usuario.updateMany({where:{id:current.id,email:current.email,role:'user',activo:true,emailVerifiedAt:null},data:{emailVerificationRequired:true}});if(changed.count!==1)return {status:'not-required'};}
        if(existing){const changed=await tx.emailVerification.updateMany({where:{usuarioId:current.id,createdAt:{lte:cutoff}},data});if(changed.count!==1)return {status:'cooldown'};}
        else await tx.emailVerification.create({data:{usuarioId:current.id,...data}});
        return {status:'claimed',usuarioId:current.id,email:current.email,nombre:current.nombre,expiresAt};
      });
    }catch{record('issue_database_failed');return {status:'unavailable'};}
    if(claimed.status!=='claimed'){record(claimed.status);return {status:claimed.status};}
    // Only the digest is persisted; the raw token exists briefly for this one delivery.
    try{
      await deliver({to:claimed.email,name:claimed.nombre,token,config,expiresAt:claimed.expiresAt,idempotencyKey:randomUUID()});record('sent');return {status:'sent'};
    }catch{
      try{await client().emailVerification.deleteMany({where:{usuarioId:claimed.usuarioId,tokenHash}});}catch{record('delivery_cleanup_failed');}
      record('delivery_failed');return {status:'unavailable'};
    }
  }
  async function consume(token){
    if(typeof token!=='string' || !TOKEN.test(token))throw invalid();
    const tokenHash=createHash('sha256').update(token).digest('hex');let verified;
    try{
      verified=await transaction(async tx=>{
        const row=await tx.emailVerification.findUnique({where:{tokenHash},select:{usuarioId:true,email:true,expiresAt:true}});
        if(!row)return false;
        const instant=new Date(now());
        if(row.expiresAt<=instant){await tx.emailVerification.deleteMany({where:{usuarioId:row.usuarioId,tokenHash}});return false;}
        const claimed=await tx.emailVerification.deleteMany({where:{usuarioId:row.usuarioId,tokenHash,expiresAt:{gt:instant}}});
        if(claimed.count!==1)return false;
        const changed=await tx.usuario.updateMany({where:{id:row.usuarioId,email:row.email,activo:true,emailVerificationRequired:true,emailVerifiedAt:null},data:{emailVerifiedAt:instant,tokenVersion:{increment:1}}});
        return changed.count===1?row.usuarioId:null;
      });
    }catch{record('consume_database_failed');throw new AppError(503,'EMAIL_VERIFICATION_UNAVAILABLE','No se pudo confirmar el correo. Intenta nuevamente.');}
    if(!verified){record('invalid');throw invalid();}
    record('verified');return {verified:true,usuarioId:verified};
  }
  return {issue,consume,requiresVerification};
}
const verification=createEmailVerification();
module.exports={...verification,createEmailVerification,requiresVerification};
