const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../models/usuarios.cjs');
const verification=require('../models/email-verification.cjs');
const {AppError} = require('../middleware/errors.cjs');
const dummyHash=bcrypt.hashSync('dummy-unusable-password',12);
module.exports = config=> {
  function session(user) {
    return {token:jwt.sign({version:user.tokenVersion},config.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:config.expires}),usuario:users.publicUser(user)};
  }
  return {
    async register(req,res) {
      const {nombre,email,telefono,password}=req.input;
      const passwordHash=await bcrypt.hash(password,12);
      const verifying=config.emailVerification?.enabled===true;
      const user=await users.create({nombre,email,telefono,passwordHash,role:'user',emailVerificationRequired:verifying});
      if(verifying){
        const delivery=await verification.issue(user,config);
        const message=delivery.status==='sent'?'Revisa tu correo y confirma tu dirección para iniciar sesión.':'Tu cuenta está pendiente de confirmación. No se pudo enviar el correo; solicita otro enlace.';
        res.status(202).json({ok:true,data:{requiresEmailVerification:true,deliveryStatus:delivery.status,message}});return;
      }
      res.status(201).json({ok:true,data:session({...user,tokenVersion:0})});
    },
    async login(req,res) {
      const user=await users.findByEmail(req.input.email);
      const valid=await bcrypt.compare(req.input.password,user?.passwordHash || dummyHash);
      if (!user || !valid || !user.activo) throw new AppError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos.');
      if(verification.requiresVerification(user))throw new AppError(403,'EMAIL_NOT_VERIFIED','Confirma tu correo antes de iniciar sesión. Puedes solicitar otro enlace.');
      res.json({ok:true,data:session(user)});
    },
    me(req,res) { res.json({ok:true,data:users.publicUser(req.user)}); },
    async updateProfile(req,res){res.json({ok:true,data:await users.updateProfile(req.user.id,req.input)});},
    async logout(req,res) { await users.revoke(req.user.id);res.status(204).end(); },
    async verifyEmail(req,res){
      const result=await verification.consume(req.input.token);
      res.json({ok:true,data:{...result,message:'Correo confirmado. Ya puedes iniciar sesión.'}});
    },
    async resendVerification(req,res){
      if(!config.emailVerification?.enabled)throw new AppError(503,'EMAIL_UNAVAILABLE','La confirmación por correo todavía no está habilitada. Contacta con la farmacia.');
      const user=await users.findByEmail(req.input.email);
      if(user?.activo && verification.requiresVerification(user))await verification.issue(user,config);
      res.status(202).json({ok:true,data:{message:'Si la cuenta existe y está pendiente, revisa tu correo y la carpeta de correo no deseado. Puedes solicitar otro enlace después de un minuto.'}});
    },
  };
};
