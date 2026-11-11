const products=require('../models/productos.cjs');
// One shared read per second while at least one storefront is connected.
// Database triggers change this opaque token inside the business transaction.
const clients=new Set(),perAddress=new Map();
let timer=null,reading=false,revision=null;
function send(client,token){
 if(!client.res.write('data: '+JSON.stringify({revision:token})+'\n\n'))client.res.end();
}
async function poll(){
 if(reading||!clients.size)return;
 reading=true;
 try{
  const row=await products.revision();
  if(row&&row.token!==revision){revision=row.token;for(const client of clients)send(client,revision);}
 }catch{for(const client of clients)client.res.end();}
 finally{reading=false;}
}
module.exports=function catalogUpdates(req,res){
 const address=req.ip,count=perAddress.get(address)||0;
 if(clients.size>=100||count>=8){res.setHeader('Retry-After','10');res.status(429).json({ok:false,error:{code:'STREAM_LIMIT',message:'Espera un momento antes de volver a conectar las actualizaciones.'}});return;}
 res.setHeader('Content-Type','text/event-stream; charset=utf-8');
 res.setHeader('Cache-Control','no-store, no-transform');
 res.setHeader('X-Accel-Buffering','no');
 if(req.method==='HEAD'){res.end();return;}
 res.flushHeaders();res.write('retry: 3000\n\n');
 const client={res};clients.add(client);perAddress.set(address,count+1);
 if(revision)send(client,revision);
 void poll();if(!timer){timer=setInterval(poll,1000);timer.unref();}
 const heartbeat=setInterval(()=>{if(!res.write(': conectado\n\n'))res.end();},10000);
 const deadline=setTimeout(()=>res.end(),45000);heartbeat.unref();deadline.unref();
 res.once('close',()=>{
  clearInterval(heartbeat);clearTimeout(deadline);clients.delete(client);
  const remaining=(perAddress.get(address)||1)-1;if(remaining)perAddress.set(address,remaining);else perAddress.delete(address);
  if(!clients.size){clearInterval(timer);timer=null;revision=null;}
 });
};
