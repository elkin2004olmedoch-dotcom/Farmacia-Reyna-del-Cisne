const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const db=require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const userSelect={...require('./usuarios.cjs').publicFields,tokenVersion:true,tokenEpoch:true};
const withUser={usuario:{select:userSelect}};
const GPS_CLEAR={latitud:null,longitud:null,precision:null,registradaAt:null,recibidaAt:null,gpsVersion:{increment:1},sesionSeguimientoId:null};
const SECRET=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const REFRESH=/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const invalid=()=>{throw new AppError(401,'INVALID_TOKEN','Tu sesión móvil ya no es válida. Inicia sesión nuevamente.');};
async function transaction(fn){
 for(let attempt=0;attempt<3;attempt++)try{return await db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});}
 catch(error){if(['P2034','P2028','P1008'].includes(error.code)&&attempt<2)continue;throw error;}
}
async function revokeTx(tx,where){
 await tx.sesionMovil.updateMany({where:{...where,revokedAt:null},data:{revokedAt:new Date()}});
 await tx.entrega.updateMany({where:{sesionSeguimiento:{is:where}},data:GPS_CLEAR});
}
function active(row,now=new Date()){
 return row&&!row.revokedAt&&row.expiresAt>now&&row.usuario.activo&&row.usuario.role==='repartidor'&&row.tokenVersion===row.usuario.tokenVersion;
}
async function checkTx(tx,id,userId,version){
 const row=typeof id==='string'?await tx.sesionMovil.findUnique({where:{id},include:withUser}):null;
 if(!row||row.usuarioId!==userId||row.tokenVersion!==version)return null;
 if(!active(row)){await revokeTx(tx,{id});return null;}
 return row;
}
async function authenticate(id,userId,version){return transaction(tx=>checkTx(tx,id,userId,version));}
async function create(user){
 const secret=randomBytes(32).toString('base64url');
 const row=await transaction(async tx=>{
  const current=await tx.usuario.findUnique({where:{id:user.id},select:userSelect});
  if(!current?.activo||current.role!=='repartidor'||current.tokenVersion!==user.tokenVersion)invalid();
  return tx.sesionMovil.create({data:{usuarioId:current.id,tokenVersion:current.tokenVersion,secretHash:hash(secret),expiresAt:new Date(Date.now()+30*86400000)},include:withUser});
 });
 return {row,refreshToken:row.id+'.'+secret};
}
function validRenew({refreshToken,nextSecret}={}){
 const match=typeof refreshToken==='string'&&REFRESH.exec(refreshToken);
 return Boolean(match&&SECRET.test(match[2])&&typeof nextSecret==='string'&&SECRET.test(nextSecret)&&nextSecret!==match[2]);
}
async function renew(input){
 if(!validRenew(input))throw new AppError(422,'VALIDATION_ERROR','La renovación de sesión no tiene un formato válido.');
 const [,id,secret]=REFRESH.exec(input.refreshToken),secretHash=hash(secret),nextHash=hash(input.nextSecret);
 const row=await transaction(async tx=>{
  let current=await tx.sesionMovil.findUnique({where:{id},include:withUser});
  if(!current)return null;
  if(!active(current)){await revokeTx(tx,{id});return null;}
  if(equal(secretHash,current.secretHash)){
   const changed=await tx.sesionMovil.updateMany({where:{id,secretHash,revokedAt:null,expiresAt:{gt:new Date()}},data:{secretHash:nextHash,previousSecretHash:secretHash}});
   if(changed.count!==1)throw Object.assign(new Error('Concurrent session rotation'),{code:'P2034'});
   current={...current,secretHash:nextHash,previousSecretHash:secretHash};
  }else if(equal(secretHash,current.previousSecretHash)){
   // A retry after a lost response must propose the same already-committed secret.
   if(!equal(nextHash,current.secretHash)){await revokeTx(tx,{id});return null;}
  }else return null;
  return current;
 });
 if(!row)invalid();
 return {row,refreshToken:id+'.'+input.nextSecret};
}
async function revoke(id,userId){return transaction(async tx=>{const row=await tx.sesionMovil.findFirst({where:{id,usuarioId:userId},select:{id:true}});if(row)await revokeTx(tx,{id});});}
module.exports={GPS_CLEAR,transaction,checkTx,authenticate,create,renew,revoke,revokeTx,validRenew};
