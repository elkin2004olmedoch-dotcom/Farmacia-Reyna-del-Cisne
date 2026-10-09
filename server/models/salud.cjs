const db=require('./db.cjs');
module.exports=()=>db.$queryRaw`SELECT 1`;
