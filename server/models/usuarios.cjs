const db = require('./db.cjs');
const publicFields = {id:true,nombre:true,email:true,telefono:true,role:true,activo:true,emailVerifiedAt:true,emailVerificationRequired:true,createdAt:true};
module.exports = {
  findByEmail:email=>db.usuario.findUnique({where:{email}}),
  findById:id=>db.usuario.findUnique({where:{id}}),
  create:data=>db.usuario.create({data,select:publicFields}),
  revoke:id=>require('./sesiones-moviles.cjs').transaction(async tx=>{
    const user=await tx.usuario.update({where:{id},data:{tokenVersion:{increment:1}}});
    await require('./sesiones-moviles.cjs').revokeTx(tx,{usuarioId:id});return user;
  }),
  publicFields,
  publicUser:user=>Object.fromEntries(Object.keys(publicFields).filter(key=>key in user).map(key=>[key,user[key]])),
};
