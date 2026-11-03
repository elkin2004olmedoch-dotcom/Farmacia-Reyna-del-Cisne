'use strict';
const {randomBytes,createHash,hkdfSync}=require('node:crypto'),OTP=require('otpauth'),jwt=require('jsonwebtoken'),bcrypt=require('bcrypt');
const db=require('./db.cjs'),{transaction}=require('./sesiones-moviles.cjs'),crypt=require('./sri-crypto.cjs'),{AppError}=require('../middleware/errors.cjs');
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>{throw new AppError(401,'MFA_INVALID','El código no es válido, ya se usó o venció. Intenta con uno nuevo.');};
const key=config=>Buffer.from(hkdfSync('sha256',Buffer.from(config.secret),Buffer.alloc(0),Buffer.from('farmacia/admin-mfa/v1'),32)).toString('hex');
const tokenFor=secret=>new OTP.TOTP({issuer:'Farmacia Reina del Cisne',label:'Administración',secret,algorithm:'SHA1',digits:6,period:30});
async function current(tx,actor){const user=await tx.usuario.findUnique({where:{id:actor.id}});if(!user?.activo||user.role!=='admin'||user.tokenVersion!==actor.tokenVersion)fail();if(actor.webSession&&!await require('./sesiones-web.cjs').checkTx(tx,actor.webSession,user.id,user.tokenVersion))fail();return user;}
async function password(user,value){if(typeof value!=='string'||Buffer.byteLength(value)>72||!await bcrypt.compare(value,user.passwordHash))throw new AppError(401,'INVALID_CREDENTIALS','Comprueba tu contraseña actual.');}
async function revoke(tx,user){await tx.usuario.update({where:{id:user.id},data:{tokenVersion:{increment:1}}});await tx.sesionWeb.updateMany({where:{usuarioId:user.id,revokedAt:null},data:{revokedAt:new Date()}});await require('./sesiones-moviles.cjs').revokeTx(tx,{usuarioId:user.id});return {...user,tokenVersion:user.tokenVersion+1};}
async function setup(actor,value,config){
 await password(await current(db,actor),value);const secret=new OTP.Secret({size:20}).base32;
 await transaction(async tx=>{await current(tx,actor);const old=await tx.adminMfa.findUnique({where:{usuarioId:actor.id}});if(old?.enabled)throw new AppError(409,'MFA_ENABLED','El segundo factor ya está activo.');const data={secretCipher:crypt.encrypt({secret},key(config)),enabled:false,setupExpiresAt:new Date(Date.now()+10*60000),lastCounter:-1,recoveryHashes:'[]'};await tx.adminMfa.upsert({where:{usuarioId:actor.id},create:{usuarioId:actor.id,...data},update:data});});
 return {secret,expiresInSeconds:600};
}
async function consume(tx,row,code,config,{recovery=true}={}){
 const now=Date.now();if(!row||row.blockedUntil&&row.blockedUntil.getTime()>now)return false;
 let hashes;try{hashes=JSON.parse(row.recoveryHashes);}catch{return false;}
 if(recovery&&typeof code==='string'&&/^[a-f0-9]{20}$/.test(code)&&hashes.includes(digest(code))){await tx.adminMfa.update({where:{usuarioId:row.usuarioId},data:{recoveryHashes:JSON.stringify(hashes.filter(v=>v!==digest(code))),failedAttempts:0,blockedUntil:null}});return true;}
 const secret=crypt.decrypt(row.secretCipher,key(config)).secret,totp=tokenFor(secret),delta=/^\d{6}$/.test(code||'')?totp.validate({token:code,window:1,timestamp:now,afterCounter:row.lastCounter}):null;
 if(delta!==null){await tx.adminMfa.update({where:{usuarioId:row.usuarioId},data:{lastCounter:Math.floor(now/30000)+delta,failedAttempts:0,blockedUntil:null}});return true;}
 const attempts=row.failedAttempts+1;await tx.adminMfa.update({where:{usuarioId:row.usuarioId},data:{failedAttempts:attempts,blockedUntil:attempts>=5?new Date(now+15*60000):null}});return false;
}
async function enable(actor,code,config){
 const codes=Array.from({length:8},()=>randomBytes(10).toString('hex'));
 const user=await transaction(async tx=>{const user=await current(tx,actor),row=await tx.adminMfa.findUnique({where:{usuarioId:actor.id}});if(!row||row.enabled||!row.setupExpiresAt||row.setupExpiresAt<Date.now())return null;if(!await consume(tx,row,code,config,{recovery:false}))return null;await tx.adminMfa.update({where:{usuarioId:actor.id},data:{enabled:true,setupExpiresAt:null,recoveryHashes:JSON.stringify(codes.map(digest))}});return revoke(tx,user);});
 if(!user)fail();return {user,recoveryCodes:codes};
}
async function challenge(user,config){
 const id=randomBytes(32).toString('hex'),row=await db.adminMfa.findUnique({where:{usuarioId:user.id}});if(!row?.enabled)return null;if(row.blockedUntil>Date.now())throw new AppError(429,'MFA_LOCKED','Espera quince minutos antes de volver a intentar.');
 await db.adminMfa.update({where:{usuarioId:user.id},data:{challengeHash:digest(id),challengeUntil:new Date(Date.now()+5*60000)}});
 return jwt.sign({version:user.tokenVersion,jti:id},config.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-mfa',expiresIn:'5m'});
}
async function login(value,code,config){
 let claims;try{claims=jwt.verify(value,config.secret,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-mfa'});}catch{fail();}
 const result=await transaction(async tx=>{const row=await tx.adminMfa.findUnique({where:{usuarioId:claims.sub}}),user=await tx.usuario.findUnique({where:{id:claims.sub}});if(!row?.enabled||!user?.activo||user.role!=='admin'||user.tokenVersion!==claims.version||row.challengeHash!==digest(claims.jti)||row.challengeUntil<Date.now())return null;if(!await consume(tx,row,code,config))return null;await tx.adminMfa.update({where:{usuarioId:user.id},data:{challengeHash:null,challengeUntil:null}});return user;});if(!result)fail();return result;
}
async function disable(actor,value,code,config){await password(await current(db,actor),value);const result=await transaction(async tx=>{const user=await current(tx,actor),row=await tx.adminMfa.findUnique({where:{usuarioId:actor.id}});if(!row?.enabled||!await consume(tx,row,code,config))return null;await tx.adminMfa.delete({where:{usuarioId:actor.id}});return revoke(tx,user);});if(!result)fail();return result;}
module.exports={setup,enable,disable,challenge,login,status:async id=>({enabled:Boolean((await db.adminMfa.findUnique({where:{usuarioId:id},select:{enabled:true}}))?.enabled)})};
