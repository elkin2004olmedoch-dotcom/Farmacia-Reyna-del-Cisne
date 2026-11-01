const jwt = require('jsonwebtoken');
const users = require('../models/usuarios.cjs');
const sessions=require('../models/sesiones-moviles.cjs');
const {AppError} = require('./errors.cjs');
function authenticate(config) {
  return async function(req,res,next) {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '');
    if (!match) throw new AppError(401,'AUTH_REQUIRED','Inicia sesión para continuar.');
    let payload;
    try { payload=jwt.verify(match[1],config.secret,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-web'}); }
    catch (_) { throw new AppError(401,'INVALID_TOKEN','Tu sesión venció o no es válida. Inicia sesión nuevamente.'); }
    let user;
    if(Object.hasOwn(payload,'mobileSession')){
      const session=typeof payload.sub==='string'?await sessions.authenticate(payload.mobileSession,payload.sub,payload.version):null;
      if(!session)throw new AppError(401,'INVALID_TOKEN','Tu sesión móvil ya no es válida.');
      req.mobileSession=session.id;user={...session.usuario,mobileSession:session.id};
    }else user=typeof payload.sub==='string' ? await users.findById(payload.sub) : null;
    if (!user || !user.activo || payload.version!==user.tokenVersion) throw new AppError(401,'INVALID_TOKEN','Tu sesión ya no es válida.');
    req.user=user;next();
  };
}
const roles = (...allowed)=> (req,res,next)=> {
  if (!allowed.includes(req.user?.role)) throw new AppError(403,'FORBIDDEN','No tienes permiso para realizar esta acción.');
  next();
};
const mobile=(req,res,next)=>{if(!req.mobileSession)throw new AppError(403,'MOBILE_SESSION_REQUIRED','Inicia sesión desde la app de reparto.');next();};
module.exports={authenticate,roles,mobile};
