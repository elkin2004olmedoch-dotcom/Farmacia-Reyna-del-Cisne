const {createHash,randomUUID}=require('node:crypto');
const validation=require('../src/models/ecuador.js');

function accessConfiguration(env){
  if(!env.ADMIN_USERNAME&&!env.ADMIN_LOGIN_PASSWORD_HASH)return null;
  const username=validation.normalizeUsername(env.ADMIN_USERNAME);
  const email=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
  const passwordHash=env.ADMIN_LOGIN_PASSWORD_HASH||null;
  if(!username||!validation.validEmail(email))throw new Error('Configura un nombre de usuario válido y el correo privado del administrador existente.');
  if(passwordHash&&!/^\$2[ab]\$(?:12|13|14)\$[./A-Za-z0-9]{53}$/.test(passwordHash))throw new Error('El acceso administrativo requiere un hash bcrypt privado compatible con coste de 12 a 14.');
  return {username,email,passwordHash};
}

async function provisionAdmin({env=process.env}={}){
  const config=accessConfiguration(env);
  if(!config)return {applied:false,configured:false};
  const db=require('../backend/models/db.cjs');
  const sessions=require('../backend/models/sesiones-moviles.cjs');
  const marker='admin-access-'+createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0,40);
  try{
    return await sessions.transaction(async tx=>{
      if(await tx.semilla.findUnique({where:{id:marker}}))return {applied:false,configured:true};
      const user=await tx.usuario.findUnique({where:{email:config.email}});
      if(!user||!user.activo||user.role!=='admin')throw new Error('El acceso sólo se puede vincular a un administrador activo existente.');
      const assigned=await tx.usuario.findUnique({where:{username:config.username}});
      if(assigned&&assigned.id!==user.id)throw new Error('El nombre de usuario ya está asignado a otra cuenta.');
      const updatedAt=new Date(Math.max(Date.now(),user.updatedAt.getTime()+1));
      await tx.usuario.update({where:{id:user.id},data:{username:config.username,updatedAt,...(config.passwordHash?{passwordHash:config.passwordHash,tokenVersion:{increment:1},tokenEpoch:randomUUID()}:{})}});
      if(config.passwordHash){
        await tx.sesionWeb.updateMany({where:{usuarioId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
        await sessions.revokeTx(tx,{usuarioId:user.id});
      }
      await tx.auditoriaAdmin.create({data:{actorId:user.id,accion:'admin.access.configure',ruta:'CLI/provision-admin',status:200}});
      await tx.semilla.create({data:{id:marker}});
      return {applied:true,configured:true};
    });
  }catch(error){
    if(error.code==='P2002'&&await db.semilla.findUnique({where:{id:marker}}))return {applied:false,configured:true};
    throw error;
  }
}

if(require.main===module){
  require('../backend/config.cjs')();
  const db=require('../backend/models/db.cjs');
  provisionAdmin().then(result=>console.info(result.applied?'Acceso administrativo configurado.':'La configuración de acceso administrativo ya está revisada.'))
    .catch(()=>{console.error('No se pudo configurar el acceso administrativo. Revisa sus variables privadas y la cuenta existente.');process.exitCode=1;})
    .finally(()=>db.$disconnect());
}
module.exports={accessConfiguration,provisionAdmin};
