const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const users=require('../models/usuarios.cjs');
const sessions=require('../models/sesiones-moviles.cjs');
const {AppError}=require('../middleware/errors.cjs');
const dummyHash=bcrypt.hashSync('dummy-unusable-mobile-password',12);
module.exports=config=>{
 function response({row,refreshToken}){
  const token=jwt.sign({version:row.tokenVersion,mobileSession:row.id},config.secret,{algorithm:'HS256',subject:row.usuarioId,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'15m'});
  return {usuario:users.publicUser(row.usuario),token,refreshToken,expiresAt:new Date(jwt.decode(token).exp*1000).toISOString(),refreshExpiresAt:row.expiresAt.toISOString()};
 }
 return {
  async login(req,res){
   const user=await users.findByEmail(req.input.email),valid=await bcrypt.compare(req.input.password,user?.passwordHash||dummyHash);
   if(!user||!valid||!user.activo||user.role!=='repartidor')throw new AppError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos.');
   res.json({ok:true,data:response(await sessions.create(user))});
  },
  async renew(req,res){res.json({ok:true,data:response(await sessions.renew(req.body))});},
  async logout(req,res){await sessions.revoke(req.mobileSession,req.user.id);res.status(204).end();},
 };
};
