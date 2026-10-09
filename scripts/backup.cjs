const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const db=require('../server/models/db.cjs');
require('../server/models/backups.cjs').createBackup({client:db}).then(result=>console.info('Respaldo creado: '+result.directory)).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
