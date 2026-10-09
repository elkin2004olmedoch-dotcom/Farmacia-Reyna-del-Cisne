const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
process.chdir(root);
if(!fs.existsSync('.env')) {
  const config=fs.readFileSync('.env.example','utf8').replace('REEMPLAZAR_POR_AL_MENOS_32_CARACTERES_ALEATORIOS',randomBytes(48).toString('hex')).replace('REEMPLAZAR_POR_UNA_CLAVE_PRIVADA','Farmacia9-'+randomBytes(18).toString('hex'));
  fs.writeFileSync('.env',config,{mode:0o600});
  console.info('Se creó .env con claves aleatorias. Consulta ADMIN_EMAIL y ADMIN_PASSWORD en ese archivo privado.');
}
for(const args of [['node_modules/prisma/build/index.js','generate','--schema','server/prisma/schema.prisma'],['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],['server/prisma/seed.cjs'],['scripts/build-frontend.cjs']]) {
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status || 1);
}
console.info('Listo. Ejecuta npm start y abre http://localhost:3000.');
