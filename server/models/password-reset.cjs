const {randomBytes,randomUUID,createHash}=require('node:crypto');
const bcrypt=require('bcrypt');
const db=require('./db.cjs');
const {transaction,revokeTx}=require('./sesiones-moviles.cjs');
const email=require('./email-delivery.cjs'),template=require('./email-template.cjs');
const {AppError}=require('../middleware/errors.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const TOKEN=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const invalid=()=>new AppError(422,'PASSWORD_RESET_INVALID','El enlace no es válido o ya venció. Solicita otro enlace para recuperar tu cuenta.');
async function deliver({to,name,token,config}){
 const url=new URL('/recuperar-cuenta',config.publicOrigin);url.hash='token='+token;
 const body={to:[to],subject:'Recupera tu cuenta | Farmacia Reina del Cisne',text:`Hola ${name}.\nCambia tu contraseña: ${url.href}\nEl enlace vence en 30 minutos y puede utilizarse una sola vez. Si no lo solicitaste, ignora este mensaje.`,html:template.frame(config.publicOrigin,'Recupera tu cuenta',`<p>Hola ${template.escape(name)}.</p><p>Recibimos una solicitud para cambiar tu contraseña.</p>${template.button(url.href,'Cambiar mi contraseña')}<p>Este enlace vence en 30 minutos y se puede usar una sola vez. Al guardar la nueva contraseña se cerrarán tus sesiones.</p><p>Si no lo solicitaste, ignora este mensaje. Tu contraseña actual seguirá funcionando.</p>`)};
 await email.sendMessage(body,config,randomUUID());
}
function createPasswordReset({deliver:send=deliver,now=()=>new Date()}={}){
 async function issue(address,config){
  if(!config.emailVerification?.enabled)return;
  const token=randomBytes(32).toString('base64url'),tokenHash=hash(token),createdAt=now();
  const claimed=await transaction(async tx=>{
   const user=await tx.usuario.findUnique({where:{email:address},select:{id:true,nombre:true,email:true,activo:true}});if(!user?.activo)return null;
   const existing=await tx.passwordReset.findUnique({where:{usuarioId:user.id}});if(existing&&createdAt-existing.createdAt<60000)return null;
   const data={email:user.email,tokenHash,expiresAt:new Date(createdAt.getTime()+30*60000),createdAt};
   await tx.passwordReset.upsert({where:{usuarioId:user.id},create:{usuarioId:user.id,...data},update:data});return user;
  });
  if(!claimed)return;
  try{await send({to:claimed.email,name:claimed.nombre,token,config:config.emailVerification});}
  catch{await db.passwordReset.deleteMany({where:{usuarioId:claimed.id,tokenHash}});require('../diagnostics.cjs').emit('password_reset',{outcome:'delivery_failed'});}
 }
 async function consume(token,password){
  if(typeof token!=='string'||!TOKEN.test(token))throw invalid();
  const tokenHash=hash(token);
  // Expensive hashing stays outside the transaction. All security changes commit together.
  const passwordHash=await bcrypt.hash(password,12);
  const changed=await transaction(async tx=>{
   const row=await tx.passwordReset.findUnique({where:{tokenHash}});if(!row||row.expiresAt<=now())return false;
   const claimed=await tx.passwordReset.deleteMany({where:{usuarioId:row.usuarioId,tokenHash,expiresAt:{gt:now()}}});if(claimed.count!==1)return false;
   const user=await tx.usuario.updateMany({where:{id:row.usuarioId,email:row.email,activo:true},data:{passwordHash,tokenVersion:{increment:1}}});if(user.count!==1)return false;
   await revokeTx(tx,{usuarioId:row.usuarioId});await tx.sesionWeb.updateMany({where:{usuarioId:row.usuarioId,revokedAt:null},data:{revokedAt:now()}});return true;
  });
  if(!changed)throw invalid();
 }
 return {issue,consume};
}
module.exports={...createPasswordReset(),createPasswordReset};
