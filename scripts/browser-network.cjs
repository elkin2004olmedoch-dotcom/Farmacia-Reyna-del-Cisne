const networks=new WeakMap();

// Register before navigation so an already pending fetch remains part of the wait.
function trackNetwork(page){
  if(networks.has(page))return;
  const state={pending:new Set(),changedAt:Date.now(),listeners:new Set(),closed:false};
  networks.set(page,state);
  function changed(){
    state.changedAt=Date.now();
    for(const listener of state.listeners)listener();
  }
  function started(request){
    if(request.resourceType()==='eventsource')return;
    state.pending.add(request);changed();
  }
  function finished(request){
    if(state.pending.delete(request))changed();
  }
  page.on('request',started);
  page.on('requestfinished',finished);
  page.on('requestfailed',finished);
  page.once('close',()=>{
    state.closed=true;changed();
    page.off('request',started);
    page.off('requestfinished',finished);
    page.off('requestfailed',finished);
  });
}

function settleNetwork(page,{idleMs=500,timeout=30000}={}){
  const state=networks.get(page);
  if(!state)throw new Error('Inicia el seguimiento de red antes de navegar.');
  return new Promise((resolve,reject)=>{
    let idleTimer;
    const deadline=setTimeout(()=>{
      const error=new Error('Las solicitudes finitas no se estabilizaron en el plazo indicado.');
      error.name='TimeoutError';finish(error);
    },timeout);
    function finish(error){
      clearTimeout(idleTimer);clearTimeout(deadline);state.listeners.delete(inspect);
      if(error)reject(error);else resolve();
    }
    function inspect(){
      clearTimeout(idleTimer);
      if(state.closed){finish(new Error('La página está cerrada.'));return;}
      if(!state.pending.size)idleTimer=setTimeout(()=>finish(),Math.max(0,idleMs-(Date.now()-state.changedAt)));
    }
    state.listeners.add(inspect);inspect();
  });
}
module.exports={trackNetwork,settleNetwork};
