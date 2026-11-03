const jwt = require('jsonwebtoken');
const users = require('../models/usuarios.cjs');
const sessions=require('../models/sesiones-moviles.cjs');
const web=require('../models/sesiones-web.cjs');
const {AppError} = require('./errors.cjs');
function authenticate(config) {
  return async function(req,res,next) {
    const fromCookie=!req.headers.authorization;
    const value=fromCookie?web.cookie(req,web.names(config).access):null;
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || (value?'Bearer '+value:''));
    if (!match) throw new AppError(401,'AUTH_REQUIRED','Inicia sesión para continuar.');
    if(fromCookie&&!['GET','HEAD','OPTIONS'].includes(req.method))web.requireWeb(req,config);
    let payload;
    try { payload=jwt.verify(match[1],config.secret,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-web'}); }
    catch (_) { throw new AppError(401,'INVALID_TOKEN','Tu sesión venció o no es válida. Inicia sesión nuevamente.'); }
    let user;
    if(Object.hasOwn(payload,'mobileSession')){
      const session=typeof payload.sub==='string'?await sessions.authenticate(payload.mobileSession,payload.sub,payload.version):null;
      if(!session)throw new AppError(401,'INVALID_TOKEN','Tu sesión móvil ya no es válida.');
      req.mobileSession=session.id;user={...session.usuario,mobileSession:session.id};
    }else if(Object.hasOwn(payload,'webSession')){
      const session=await web.authenticate(payload.webSession,payload.sub,payload.version);
      if(!session)throw new AppError(401,'INVALID_TOKEN','Tu sesión web ya no es válida.');
      req.webSession=session.id;user={...session.usuario,webSession:session.id};
    }else if(!fromCookie)user=typeof payload.sub==='string' ? await users.findById(payload.sub) : null;
    if (!user || !user.activo || payload.version!==user.tokenVersion) throw new AppError(401,'INVALID_TOKEN','Tu sesión ya no es válida.');
    if(require('../models/email-verification.cjs').requiresVerification(user,config.requireVerifiedRegistration&&user.role==='user'))throw new AppError(403,'EMAIL_NOT_VERIFIED','Confirma tu correo antes de continuar.');
    req.user=user;next();
  };
}
const roles = (...allowed)=> (req,res,next)=> {
  if (!allowed.includes(req.user?.role)) throw new AppError(403,'FORBIDDEN','No tienes permiso para realizar esta acción.');
  next();
};
const mobile=(req,res,next)=>{if(!req.mobileSession)throw new AppError(403,'MOBILE_SESSION_REQUIRED','Inicia sesión desde la app de reparto.');next();};
module.exports={authenticate,roles,mobile};
