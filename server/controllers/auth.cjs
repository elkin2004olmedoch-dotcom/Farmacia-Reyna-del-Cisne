const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../models/usuarios.cjs');
const verification=require('../models/email-verification.cjs');
const web=require('../models/sesiones-web.cjs');
const {AppError} = require('../middleware/errors.cjs');
const dummyHash=bcrypt.hashSync('dummy-unusable-password',12);
module.exports = config=> {
  async function session(req,res,user) {
    if(req.get('X-Farmacia-Web')==='1'){web.requireWeb(req,config);return web.write(res,config,await web.create(user));}
    return {token:jwt.sign({version:user.tokenVersion,epoch:user.tokenEpoch||undefined},config.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:config.expires}),usuario:users.publicUser(user)};
  }
  return {
    async register(req,res) {
      if(config.requireVerifiedRegistration&&!config.emailVerification?.enabled)throw new AppError(503,'EMAIL_UNAVAILABLE','El registro requiere confirmar tu correo. El servicio de envío se está configurando; inténtalo más tarde.');
      const {nombre,email,telefono,password}=req.input;
      const passwordHash=await bcrypt.hash(password,12);
      const verifying=config.emailVerification?.enabled===true;
      const user=await users.create({nombre,email,telefono,passwordHash,role:'user',emailVerificationRequired:verifying});
      if(verifying){
        const delivery=await verification.issue(user,config);
        const message=delivery.status==='sent'?'Revisa tu correo y confirma tu dirección para iniciar sesión.':'Tu cuenta está pendiente de confirmación. No se pudo enviar el correo; solicita otro enlace.';
        res.status(202).json({ok:true,data:{requiresEmailVerification:true,deliveryStatus:delivery.status,message}});return;
      }
      res.status(201).json({ok:true,data:await session(req,res,{...user,tokenVersion:0})});
    },
    async login(req,res) {
      const user=await users.findByEmail(req.input.email);
      const valid=await bcrypt.compare(req.input.password,user?.passwordHash || dummyHash);
      if (!user || !valid || !user.activo) throw new AppError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos.');
      if(verification.requiresVerification(user,config.requireVerifiedRegistration&&user.role==='user'))throw new AppError(403,'EMAIL_NOT_VERIFIED','Confirma tu correo antes de iniciar sesión. Puedes solicitar otro enlace.');
      const challenge=user.role==='admin'?await require('../models/admin-mfa.cjs').challenge(user,config):null;
      if(challenge){res.json({ok:true,data:{mfaRequired:true,challenge}});return;}
      res.json({ok:true,data:await session(req,res,user)});
    },
    async mfaStatus(req,res){res.json({ok:true,data:await require('../models/admin-mfa.cjs').status(req.user.id)});},
    async mfaSetup(req,res){res.json({ok:true,data:await require('../models/admin-mfa.cjs').setup(req.user,req.body.password,config)});},
    async mfaEnable(req,res){const result=await require('../models/admin-mfa.cjs').enable(req.user,req.body.code,config);res.json({ok:true,data:{...await session(req,res,result.user),recoveryCodes:result.recoveryCodes}});},
    async mfaDisable(req,res){const user=await require('../models/admin-mfa.cjs').disable(req.user,req.body.password,req.body.code,config);res.json({ok:true,data:await session(req,res,user)});},
    async mfaLogin(req,res){const user=await require('../models/admin-mfa.cjs').login(req.body.challenge,req.body.code,config);res.json({ok:true,data:await session(req,res,user)});},
    me(req,res) { res.json({ok:true,data:users.publicUser(req.user)}); },
    async updateProfile(req,res){res.json({ok:true,data:await users.updateProfile(req.user.id,req.input)});},
    async logout(req,res) { await users.revoke(req.user.id);web.clear(res,config);res.status(204).end(); },
    async refresh(req,res){
      web.requireWeb(req,config);const result=await web.renew(web.cookie(req,web.names(config).refresh),config);
      if(!result){web.clear(res,config);res.status(204).end();return;}
      if(verification.requiresVerification(result.row.usuario,config.requireVerifiedRegistration&&result.row.usuario.role==='user')){web.clear(res,config);res.status(204).end();return;}
      res.json({ok:true,data:web.write(res,config,result)});
    },
    async exchange(req,res){
      web.requireWeb(req,config);
      if(req.mobileSession||req.webSession)throw new AppError(403,'FORBIDDEN','Inicia sesión desde la web.');
      res.json({ok:true,data:await session(req,res,req.user)});
    },
    async forgotPassword(req,res){
      await require('../models/password-reset.cjs').issue(req.input.email,config);
      res.status(202).json({ok:true,data:{message:'Si existe una cuenta activa con ese correo, recibirás un enlace para cambiar tu contraseña. Revisa también el correo no deseado.'}});
    },
    async resetPassword(req,res){
      await require('../models/password-reset.cjs').consume(req.input.token,req.input.password);web.clear(res,config);
      res.json({ok:true,data:{message:'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'}});
    },
    async verifyEmail(req,res){
      const {usuarioId}=await verification.consume(req.input.token);
      const user=await users.findById(usuarioId,{...users.publicFields,tokenVersion:true,tokenEpoch:true});
      const enter=user?.activo&&user.emailVerifiedAt&&user.role==='user';
      res.json({ok:true,data:{verified:true,...(enter?await session(req,res,user):{}),message:enter?'Correo confirmado. Bienvenido a la farmacia.':'Correo confirmado. Inicia sesión para continuar.'}});
    },
    async resendVerification(req,res){
      if(!config.emailVerification?.enabled)throw new AppError(503,'EMAIL_UNAVAILABLE','La confirmación por correo todavía no está habilitada. Contacta con la farmacia.');
      const user=await users.findByEmail(req.input.email);
      if(user?.activo && verification.requiresVerification(user,config.requireVerifiedRegistration&&user.role==='user'))await verification.issue(user,config);
      res.status(202).json({ok:true,data:{message:'Si la cuenta existe y está pendiente, revisa tu correo y la carpeta de correo no deseado. Puedes solicitar otro enlace después de un minuto.'}});
    },
  };
};
