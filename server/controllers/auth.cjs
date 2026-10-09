const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../models/usuarios.cjs');
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
      const user=await users.create({nombre,email,telefono,passwordHash,role:'user'});
      res.status(201).json({ok:true,data:session({...user,tokenVersion:0})});
    },
    async login(req,res) {
      const user=await users.findByEmail(req.input.email);
      const valid=await bcrypt.compare(req.input.password,user?.passwordHash || dummyHash);
      if (!user || !valid || !user.activo) throw new AppError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos.');
      res.json({ok:true,data:session(user)});
    },
    me(req,res) { res.json({ok:true,data:users.publicUser(req.user)}); },
    async logout(req,res) { await users.revoke(req.user.id);res.status(204).end(); },
  };
};
