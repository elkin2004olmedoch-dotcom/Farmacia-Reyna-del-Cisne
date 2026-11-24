const db = require('./db.cjs');
const publicFields = {id:true,nombre:true,email:true,username:true,telefono:true,role:true,activo:true,emailVerifiedAt:true,emailVerificationRequired:true,createdAt:true,updatedAt:true};
const sessionFields={...publicFields,tokenVersion:true,tokenEpoch:true,asignacionRol:{select:{rolId:true}}};
module.exports = {
  findByEmail:email=>db.usuario.findUnique({where:{email}}),
  findByLogin:identifier=>db.usuario.findUnique({where:identifier.includes('@')?{email:identifier}:{username:identifier}}),
  findById:(id,select)=>db.usuario.findUnique({where:{id},...(select?{select}:{})}),
  create:(data,client=db)=>client.usuario.create({data,select:publicFields}),
  updateProfile:(id,{nombre,telefono})=>db.usuario.update({where:{id,activo:true},data:{nombre,telefono},select:publicFields}),
  revoke:id=>require('./sesiones-moviles.cjs').transaction(async tx=>{
    const user=await tx.usuario.update({where:{id},data:{tokenVersion:{increment:1}}});
    await require('./sesiones-moviles.cjs').revokeTx(tx,{usuarioId:id});
    await tx.sesionWeb.updateMany({where:{usuarioId:id,revokedAt:null},data:{revokedAt:new Date()}});return user;
  }),
  publicFields,sessionFields,
  publicUser:user=>Object.fromEntries(Object.keys(publicFields).filter(key=>key in user).map(key=>[key,user[key]])),
};
