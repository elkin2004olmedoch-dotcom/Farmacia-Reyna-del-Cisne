const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const args=process.argv.slice(2);const index=args.indexOf('--from');
if(index<0 || !args[index+1] || args[index+1].startsWith('--')){console.error('Uso: npm run backup:restore -- --from "carpeta-del-respaldo" --offline [--replace]');process.exitCode=1;}
else require('../server/models/backups.cjs').restoreBackup({from:path.resolve(args[index+1]),replace:args.includes('--replace'),offline:args.includes('--offline')}).then(result=>console.info('Restauración completada: '+result.database+(result.previousBackup?'\nRespaldo previo: '+result.previousBackup:''))).catch(error=>{console.error(error.message);process.exitCode=1;});
