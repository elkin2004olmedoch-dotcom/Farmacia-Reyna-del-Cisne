const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('el navegador retira únicamente registros y cachés de la farmacia sin ofrecer nuevas instalaciones',async t=>{
  const source=fs.readFileSync('src/controllers/install.js','utf8').replace(/^import .*;\r?\n/gm,'');
  const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(typeof module.retireInstallations,'function');
  const deleted=[],unregistered=[];
  const own=script=>({active:{scriptURL:'https://farmacia.test/'+script},unregister:async()=>{unregistered.push(script);return true;}});
  for(const [key,value] of Object.entries({location:{origin:'https://farmacia.test'},navigator:{serviceWorker:{getRegistrations:async()=>[own('app-worker.js'),own('service-worker.js'),own('unrelated-worker.js')]}},caches:{keys:async()=>['farmacia-mvc-offline-v2','another-project'],delete:async key=>{deleted.push(key);return true;}}})){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});t.after(()=>descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key]);
  }
  await module.retireInstallations();
  assert.deepEqual(unregistered,['app-worker.js','service-worker.js']);assert.deepEqual(deleted,['farmacia-mvc-offline-v2']);
});
