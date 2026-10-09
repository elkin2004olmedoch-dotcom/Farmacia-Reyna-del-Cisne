const db = require('./db.cjs');
const publicFields = {id:true,nombre:true,email:true,telefono:true,role:true,activo:true,createdAt:true};
module.exports = {
  findByEmail:email=>db.usuario.findUnique({where:{email}}),
  findById:id=>db.usuario.findUnique({where:{id}}),
  create:data=>db.usuario.create({data,select:publicFields}),
  revoke:id=>db.usuario.update({where:{id},data:{tokenVersion:{increment:1}}}),
  publicFields,
  publicUser:user=>Object.fromEntries(Object.keys(publicFields).filter(key=>key in user).map(key=>[key,user[key]])),
};
