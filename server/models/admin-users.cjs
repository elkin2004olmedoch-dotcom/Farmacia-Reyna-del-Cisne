const bcrypt=require('bcrypt');
const db=require('./db.cjs');
const users=require('./usuarios.cjs');
const sessions=require('./sesiones-moviles.cjs');
const {AppError}=require('../middleware/errors.cjs');

async function authorize(tx,actor){
 const current=await tx.usuario.findUnique({where:{id:actor.id}});
 if(!current?.activo||current.tokenVersion!==actor.tokenVersion||(current.tokenEpoch??null)!==(actor.tokenEpoch??null))throw new AppError(401,'INVALID_TOKEN','Tu sesión ya no es válida.');
 if(current.role!=='admin')throw new AppError(403,'FORBIDDEN','No tienes permiso para gestionar usuarios.');
 if(actor.webSession&&!await require('./sesiones-web.cjs').checkTx(tx,actor.webSession,actor.id,actor.tokenVersion))throw new AppError(401,'INVALID_TOKEN','Tu sesión web ya no es válida.');
}
function audit(tx,actor,action,status){return tx.auditoriaAdmin.create({data:{actorId:actor.id,accion:action,ruta:action==='user.create'?'/api/admin/usuarios':'/api/admin/usuarios/:id',status}});}
async function find(id){
 const user=await db.usuario.findUnique({where:{id},select:users.publicFields});
 if(!user)throw new AppError(404,'NOT_FOUND','No se encontró el usuario.');
 return user;
}
async function create({password,...values},actor){
 const passwordHash=await bcrypt.hash(password,12);
 return sessions.transaction(async tx=>{
  await authorize(tx,actor);
  const user=await users.create({...values,passwordHash},tx);
  await audit(tx,actor,'user.create',201);
  return user;
 });
}
async function update(id,{password,esperadoUpdatedAt,...values},actor,action='user.update'){
 const passwordHash=password===undefined?undefined:await bcrypt.hash(password,12);
 return sessions.transaction(async tx=>{
  await authorize(tx,actor);
  const current=await tx.usuario.findUnique({where:{id}});
  if(!current)throw new AppError(404,'NOT_FOUND','No se encontró el usuario.');
  const expected=new Date(esperadoUpdatedAt);
  if(current.updatedAt.getTime()!==expected.getTime())throw new AppError(409,'USER_CHANGED','El usuario cambió. Vuelve a abrir la edición antes de guardar.');
  const merged={...current,...values};
  if(current.role==='admin'&&current.activo&&(!merged.activo||merged.role!=='admin')&&await tx.usuario.count({where:{role:'admin',activo:true}})<=1)throw new AppError(409,'LAST_ADMIN','Debe permanecer al menos un administrador activo.');
  const retireCourier=current.role==='repartidor'&&(!merged.activo||merged.role!=='repartidor');
  if(retireCourier)await require('./entregas.cjs').retireDriverTx(tx,id);
  const accessChanged=passwordHash!==undefined||['role','activo','username','email'].some(key=>merged[key]!==current[key]);
  const changed=await tx.usuario.updateMany({where:{id,updatedAt:expected},data:{...values,...(passwordHash?{passwordHash}:{}),...(values.email!==undefined&&values.email!==current.email?{emailVerifiedAt:null}:{}),...(accessChanged?{tokenVersion:{increment:1}}:{}),updatedAt:new Date(Math.max(Date.now(),current.updatedAt.getTime()+1))}});
  if(changed.count!==1)throw new AppError(409,'USER_CHANGED','El usuario cambió. Vuelve a abrir la edición antes de guardar.');
  if(accessChanged){
   if(!retireCourier)await sessions.revokeTx(tx,{usuarioId:id});
   await tx.sesionWeb.updateMany({where:{usuarioId:id,revokedAt:null},data:{revokedAt:new Date()}});
  }
  if(passwordHash!==undefined||values.email!==undefined&&values.email!==current.email){
   await tx.passwordReset.deleteMany({where:{usuarioId:id}});
   await tx.registroPendiente.deleteMany({where:{usuarioId:id}});
  }
  if(values.email!==undefined&&values.email!==current.email)await tx.emailVerification.deleteMany({where:{usuarioId:id}});
  await audit(tx,actor,action,action==='user.deactivate'?204:200);
  return tx.usuario.findUnique({where:{id},select:users.publicFields});
 });
}
module.exports={find,create,update,remove:(id,version,actor)=>update(id,{activo:false,esperadoUpdatedAt:version},actor,'user.deactivate')};
