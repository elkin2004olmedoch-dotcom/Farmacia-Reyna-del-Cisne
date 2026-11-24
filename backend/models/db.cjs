const { PrismaClient } = require('./prisma-client.cjs');
const diagnostics=require('../diagnostics.cjs');
const prisma = new PrismaClient(diagnostics.enabled()?{log:[{emit:'event',level:'query'}]}:undefined);
if(diagnostics.enabled()){
  let ordinal=0;
  prisma.$on('query',event=>{if(Number.isFinite(event.duration))diagnostics.emit('sql',{ordinal:++ordinal,queryRoundTripMs:event.duration});});
}
module.exports = prisma;
