function listen(server,port,host) {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{server.removeListener('error',failed);server.removeListener('listening',ready);};
    const failed=error=>{cleanup();reject(error);};
    const ready=()=>{cleanup();resolve();};
    server.once('error',failed);server.once('listening',ready);
    try{server.listen(port,host);}catch(error){failed(error);}
  });
}

function createShutdown(server,{stop,disconnect,timeoutMs=25000}) {
  let closing;
  return function shutdown() {
    if(closing)return closing;
    let timer;
    const cleanup=(async()=>{
      try{
        await new Promise((resolve,reject)=>server.close(error=>error && error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):resolve()));
        await stop();
      }finally{await disconnect();}
    })();
    const deadline=new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{
        // A forced close can leave a write or provider call with an uncertain result.
        // Reconcile it before retrying; closing a connection does not undo a commit.
        server.closeAllConnections();
        const error=new Error('Se agotó el plazo de cierre.');error.code='SHUTDOWN_TIMEOUT';reject(error);
      },timeoutMs);
    });
    closing=Promise.race([cleanup,deadline]).finally(()=>clearTimeout(timer));
    return closing;
  };
}
module.exports={listen,createShutdown};
