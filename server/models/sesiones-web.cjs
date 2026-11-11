const {randomBytes,createHash,createHmac,timingSafeEqual}=require('node:crypto');
const jwt=require('jsonwebtoken');
const db=require('./db.cjs');
const {transaction}=require('./sesiones-moviles.cjs');
const users=require('./usuarios.cjs');
const {AppError}=require('../middleware/errors.cjs');
const withUser={usuario:{select:{...users.publicFields,tokenVersion:true,tokenEpoch:true}}};
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const active=(row,now=new Date())=>row&&!row.revokedAt&&row.expiresAt>now&&row.usuario.activo&&row.tokenVersion===row.usuario.tokenVersion;
const parseRefresh=value=>typeof value==='string'&&/^([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
const nextSecret=(value,config)=>createHmac('sha256',config.secret).update('farmacia:web-refresh:v1:'+value).digest('base64url');
const previousSecret=(row,secret,config)=>equal(hash(secret),row.previousSecretHash)&&row.previousUntil>new Date()&&equal(hash(nextSecret(secret,config)),row.secretHash);
const names=config=>({access:(config.production?'__Host-':'')+'farmacia-access',refresh:(config.production?'__Host-':'')+'farmacia-refresh'});
const options=config=>({httpOnly:true,secure:config.production===true,sameSite:'strict',path:'/'});
function cookie(req,name){
 const found=(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));
 return found.length===1?found[0].slice(name.length+1):null;
}
function requireWeb(req,config){
 if(req.get('X-Farmacia-Web')!=='1'||!config.origins.includes(req.get('Origin')))throw new AppError(403,'CSRF_FORBIDDEN','Abre la farmacia desde su dirección autorizada e intenta nuevamente.');
}
function clear(res,config){for(const name of Object.values(names(config)))res.clearCookie(name,options(config));}
function write(res,config,{row,refreshToken}){
 const token=jwt.sign({version:row.tokenVersion,epoch:row.usuario.tokenEpoch||undefined,webSession:row.id},config.secret,{algorithm:'HS256',subject:row.usuarioId,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'15m'});
 res.cookie(names(config).access,token,{...options(config),maxAge:15*60000});
 res.cookie(names(config).refresh,refreshToken,{...options(config),maxAge:Math.max(0,row.expiresAt-Date.now())});
 return {usuario:users.publicUser(row.usuario)};
}
async function create(user,{tx,secret=randomBytes(32).toString('base64url')}={}){
 const action=async tx=>{
  const current=await tx.usuario.findUnique({where:{id:user.id},select:{...users.publicFields,tokenVersion:true,tokenEpoch:true}});
  if(!current?.activo||current.tokenVersion!==user.tokenVersion)throw new AppError(401,'INVALID_TOKEN','Inicia sesión nuevamente.');
  await tx.sesionWeb.deleteMany({where:{usuarioId:current.id,expiresAt:{lte:new Date()}}});
  // Bound live sessions per account without touching business records.
  const recent=await tx.sesionWeb.findMany({where:{usuarioId:current.id,revokedAt:null},orderBy:{createdAt:'desc'},skip:9,select:{id:true}});
  if(recent.length)await tx.sesionWeb.updateMany({where:{id:{in:recent.map(r=>r.id)}},data:{revokedAt:new Date()}});
  return tx.sesionWeb.create({data:{usuarioId:current.id,tokenVersion:current.tokenVersion,secretHash:hash(secret),expiresAt:new Date(Date.now()+30*86400000)},include:withUser});
 };
 const row=await(tx?action(tx):transaction(action));
 return {row,refreshToken:row.id+'.'+secret};
}
async function checkTx(client,id,usuarioId,version){
 if(typeof id!=='string')return null;
 const row=await client.sesionWeb.findUnique({where:{id},include:withUser});
 return active(row)&&row.usuarioId===usuarioId&&row.tokenVersion===version?row:null;
}
const authenticate=(id,usuarioId,version)=>checkTx(db,id,usuarioId,version);
async function checkRefreshTx(client,value,config){
 const match=parseRefresh(value);
 if(!match)return null;
 const [,id,secret]=match,row=await client.sesionWeb.findUnique({where:{id},include:withUser});
 return active(row)&&(equal(hash(secret),row.secretHash)||previousSecret(row,secret,config))?row:null;
}
async function renew(value,config){
 const match=parseRefresh(value);
 if(!match)return null;
 const [,id,secret]=match,digest=hash(secret);
 return transaction(async tx=>{
  const row=await tx.sesionWeb.findUnique({where:{id},include:withUser});
  if(!active(row))return null;
  if(equal(digest,row.secretHash)){
   const next=nextSecret(secret,config),now=new Date();
   const changed=await tx.sesionWeb.updateMany({where:{id,secretHash:digest,revokedAt:null},data:{secretHash:hash(next),previousSecretHash:digest,previousUntil:new Date(now.getTime()+5*60000)}});
   if(changed.count!==1)throw Object.assign(new Error('Concurrent session rotation'),{code:'P2034'});
   return {row,refreshToken:id+'.'+next};
  }
  if(previousSecret(row,secret,config))return {row,refreshToken:id+'.'+nextSecret(secret,config)};
  return null;
 });
}
module.exports={names,options,cookie,requireWeb,clear,write,create,authenticate,checkTx,checkRefreshTx,renew};
