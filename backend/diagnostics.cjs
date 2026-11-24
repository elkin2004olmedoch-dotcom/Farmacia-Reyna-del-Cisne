const {randomUUID}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const bootId=randomUUID();
const enabled=()=>process.env.PERF_DIAGNOSTICS==='1';
const elapsed=start=>Math.round((performance.now()-start)*100)/100;
function emit(event,fields={}){
  if(enabled())console.info(JSON.stringify({level:'info',event,bootId,at:new Date().toISOString(),uptimeMs:Math.round(process.uptime()*1000),...fields}));
}
function phase(name){emit('startup',{phase:name});}
async function connect(client){
  const start=performance.now();let success=false;
  try{await client.$connect();success=true;}finally{emit('prisma_connect',{durationMs:elapsed(start),success});}
}
module.exports={enabled,emit,phase,connect,elapsed,bootId};
