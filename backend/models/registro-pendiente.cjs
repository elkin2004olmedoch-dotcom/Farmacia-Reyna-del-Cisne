'use strict';
const {randomBytes,createHash,createHmac,timingSafeEqual}=require('node:crypto');
const jwt=require('jsonwebtoken');
const users=require('./usuarios.cjs');
const web=require('./sesiones-web.cjs');
const {transaction}=require('./sesiones-moviles.cjs');
const TTL_MS=3600000,RETRY_MS=60000;
const secretPattern=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const name=config=>(config.production?'__Host-':'')+'farmacia-registro';
const select={...users.publicFields,tokenVersion:true,tokenEpoch:true};
const correlation=(secret,config)=>createHmac('sha256',config.secret).update('farmacia:registro-correlacion:v1:'+secret).digest('base64url');
function clear(res,config){res.clearCookie(name(config),web.options(config));}
async function register(data,res,config){
  const secret=randomBytes(32).toString('base64url'),createdAt=new Date(),expiresAt=new Date(createdAt.getTime()+TTL_MS);
  const user=await transaction(async tx=>{
    const created=await users.create(data,tx);
    await tx.registroPendiente.create({data:{usuarioId:created.id,email:created.email,secretHash:hash(secret),tokenVersion:0,tokenEpoch:null,createdAt,expiresAt}});
    return created;
  });
  res.cookie(name(config),secret,{...web.options(config),maxAge:TTL_MS});
  return {user,registrationId:correlation(secret,config)};
}
async function currentSession(tx,access,refresh,config){
  let payload=null;
  try{if(access)payload=jwt.verify(access,config.secret,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-web'});}catch{}
  if(typeof payload?.sub==='string'&&typeof payload.webSession==='string'){
    const session=await web.checkTx(tx,payload.webSession,payload.sub,payload.version);
    if(session&&(payload.epoch??null)===(session.usuario.tokenEpoch??null))return session;
  }
  return web.checkRefreshTx(tx,refresh,config);
}
async function resume(req,config){
  const secret=web.cookie(req,name(config));
  if(!secretPattern.test(secret||''))return null;
  const registrationId=req.body.registrationId,expected=correlation(secret,config);
  if(registrationId.length!==expected.length||!timingSafeEqual(Buffer.from(registrationId),Buffer.from(expected)))return {blocked:true};
  const secretHash=hash(secret),refreshSecret=createHmac('sha256',config.secret).update('farmacia:registro-pendiente:v1:'+secret).digest('base64url');
  return transaction(async tx=>{
    const pending=await tx.registroPendiente.findUnique({where:{secretHash},include:{usuario:{select}}}),now=new Date();
    if(!pending||pending.expiresAt<=now)return null;
    const user=pending.usuario;
    if(!user.activo||user.role!=='user'||user.email!==pending.email||(user.tokenEpoch??null)!==(pending.tokenEpoch??null))return null;
    const names=web.names(config),existing=await currentSession(tx,web.cookie(req,names.access),web.cookie(req,names.refresh),config);
    if(existing)return existing.usuarioId===user.id?{usuario:users.publicUser(existing.usuario)}:{blocked:true};
    if(!user.emailVerifiedAt)return user.tokenVersion===pending.tokenVersion?{pending:true}:null;
    if(user.tokenVersion!==pending.tokenVersion+1||user.emailVerifiedAt<pending.createdAt)return null;
    if(pending.consumedAt){
      if(pending.consumedAt.getTime()+RETRY_MS<=now.getTime())return null;
      const session=await web.checkTx(tx,pending.sessionId,user.id,user.tokenVersion);
      return session&&session.secretHash===hash(refreshSecret)?{row:session,refreshToken:session.id+'.'+refreshSecret}:null;
    }
    const result=await web.create(user,{tx,secret:refreshSecret});
    const consumed=await tx.registroPendiente.updateMany({where:{usuarioId:user.id,secretHash,consumedAt:null,sessionId:null},data:{consumedAt:now,sessionId:result.row.id}});
    if(consumed.count!==1)throw Object.assign(new Error('Concurrent registration continuation'),{code:'P2034'});
    return result;
  });
}
module.exports={register,resume,clear,name};
