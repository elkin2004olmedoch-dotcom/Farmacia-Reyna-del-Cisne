const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once,EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {listen,createShutdown}=require('../../server/lifecycle.cjs');

test('escucha rechaza un puerto ocupado y permite limpiar el arranque',async()=>{
  const first=http.createServer();const second=http.createServer();
  try{await listen(first,0,'127.0.0.1');await assert.rejects(listen(second,first.address().port,'127.0.0.1'),error=>error.code==='EADDRINUSE');}
  finally{await new Promise(resolve=>first.close(resolve));await new Promise(resolve=>second.close(resolve));}
});

test('señales repetidas comparten el cierre y desconectan aunque falle la limpieza',async()=>{
  const server=http.createServer();await listen(server,0,'127.0.0.1');
  let stopped=0,disconnected=0;
  const shutdown=createShutdown(server,{stop:async()=>{stopped++;throw new Error('synthetic-cleanup');},disconnect:async()=>{disconnected++;},timeoutMs:500});
  const first=shutdown();const second=shutdown();assert.equal(first,second);
  await assert.rejects(first,/synthetic-cleanup/);assert.equal(stopped,1);assert.equal(disconnected,1);assert.equal(server.listening,false);
});

test('el cierre tiene un plazo y corta una respuesta HTTP que no termina',async()=>{
  let entered;
  const started=new Promise(resolve=>entered=resolve);const server=http.createServer((req,res)=>{res.writeHead(200);res.write('pending');entered();});
  await listen(server,0,'127.0.0.1');const request=http.get({host:'127.0.0.1',port:server.address().port,path:'/'});request.on('error',()=>{});request.on('response',response=>{response.on('error',()=>{});response.resume();});
  await started;let disconnected=0;
  const shutdown=createShutdown(server,{stop:async()=>{},disconnect:async()=>{disconnected++;},timeoutMs:40});
  const closed=once(server,'close');const start=Date.now();
  await assert.rejects(shutdown(),error=>error.code==='SHUTDOWN_TIMEOUT');
  await closed;await new Promise(resolve=>setImmediate(resolve));
  assert.ok(Date.now()-start<1500);assert.equal(disconnected,1);assert.equal(server.listening,false);request.destroy();
});

test('el plazo también acota una limpieza bloqueada',async()=>{
  const server=http.createServer();await listen(server,0,'127.0.0.1');
  let release;const stopped=new Promise(resolve=>release=resolve);let disconnected=0;
  const shutdown=createShutdown(server,{stop:()=>stopped,disconnect:async()=>{disconnected++;},timeoutMs:40});
  await assert.rejects(shutdown(),error=>error.code==='SHUTDOWN_TIMEOUT');release();await new Promise(resolve=>setImmediate(resolve));assert.equal(disconnected,1);
});

function gate(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
function startup({backupGate,listenGate,timeoutMs=500}={}){
  const process=new EventEmitter();process.env={DATABASE_URL:backupGate?'file:synthetic-startup.db':'postgresql://synthetic.invalid/test'};
  const exits=[],phases=[],timers=[];let server,disconnected=0;const bound=gate();
  process.exit=code=>exits.push(code);
  const imports={
    './diagnostics.cjs':{phase:value=>phases.push(value),emit:()=>{}},
    'node:fs':fs,'node:http':{createServer:app=>server=http.createServer(app)},'node:https':{},
    './lifecycle.cjs':{listen:async(...args)=>{await listen(...args);bound.resolve();if(listenGate)await listenGate.promise;},createShutdown:(server,options)=>createShutdown(server,{...options,timeoutMs})},
    './config.cjs':()=>({host:'127.0.0.1',port:0}),'./app.cjs':()=>((req,res)=>res.end('synthetic')),
    './models/backups.cjs':{startAutomaticBackups:()=>backupGate.promise},
    './models/db.cjs':{$disconnect:async()=>{disconnected++;}},
    './models/entregas.cjs':{purgeExpiredLocations:async()=>{}},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../server/index.cjs'),'utf8'),{
    require:id=>{assert.ok(Object.hasOwn(imports,id),'importación no controlada: '+id);return imports[id];},process,console:{info:()=>{},error:()=>{}},
    setTimeout:(...args)=>{const timer=setTimeout(...args);timers.push(timer);return timer;},clearTimeout,
    setInterval:(...args)=>{const timer=setInterval(...args);timers.push(timer);return timer;},clearInterval,
  });
  return {process,exits,phases,timers,bound,server:()=>server,disconnected:()=>disconnected,cleanup:async()=>{for(const timer of timers){clearTimeout(timer);clearInterval(timer);}await new Promise(resolve=>server.close(resolve));}};
}

test('SIGTERM durante el inicio de respaldos espera su recurso y lo cierra antes de desconectar',async()=>{
  const backupGate=gate();let stopped=0;const state=startup({backupGate});
  try{
    state.process.emit('SIGTERM');await flush();
    assert.deepEqual(state.exits,[],'no debe salir mientras el recurso de respaldo todavía se está creando');
    assert.equal(state.disconnected(),0);
    backupGate.resolve({stop:async()=>{stopped++;}});await flush();await flush();
    assert.equal(stopped,1);assert.equal(state.disconnected(),1);assert.deepEqual(state.exits,[0]);
    assert.equal(state.phases.includes('listening'),false);assert.equal(state.timers.length,0);assert.equal(state.server().listening,false);
  }finally{backupGate.resolve({stop:async()=>{stopped++;}});await flush();await state.cleanup();}
});

test('SIGTERM durante respaldos bloqueados conserva el plazo total de cierre',async()=>{
  const backupGate=gate();const state=startup({backupGate,timeoutMs:40});
  try{
    state.process.emit('SIGTERM');await new Promise(resolve=>setTimeout(resolve,100));
    assert.deepEqual(state.exits,[1]);assert.equal(state.server().listening,false);
    backupGate.resolve({stop:async()=>{}});await flush();assert.equal(state.disconnected(),1);
  }finally{backupGate.resolve({stop:async()=>{}});await flush();await state.cleanup();}
});

test('SIGTERM durante listen no vuelve a crear tareas tras cerrar el servidor',async()=>{
  const listenGate=gate();const state=startup({listenGate});
  try{
    await state.bound.promise;state.process.emit('SIGTERM');await flush();
    listenGate.resolve();await flush();await flush();
    assert.deepEqual(state.exits,[0]);assert.equal(state.disconnected(),1);
    assert.equal(state.phases.includes('listening'),false);assert.equal(state.timers.length,0);assert.equal(state.server().listening,false);
  }finally{listenGate.resolve();await state.cleanup();}
});
