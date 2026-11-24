const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('el worker de retirada se desregistra, limpia sus cachés y deja pasar todas las peticiones',async()=>{
  const handlers={},deleted=[];let unregistered=0,skipped=0;
  const self={addEventListener:(name,listener)=>{handlers[name]=listener;},skipWaiting:async()=>{skipped++;},registration:{unregister:async()=>{unregistered++;}}};
  const caches={keys:async()=>['farmacia-mvc-offline-v1','farmacia-mvc-offline-v2','another-project'],delete:async key=>{deleted.push(key);return true;}};
  vm.runInNewContext(fs.readFileSync('src/app-worker.js','utf8'),{self,caches});
  assert.equal(handlers.fetch,undefined);
  async function dispatch(name){const pending=[];handlers[name]({waitUntil:promise=>pending.push(promise)});await Promise.all(pending);}
  await dispatch('install');await dispatch('activate');
  assert.equal(skipped,1);assert.equal(unregistered,1);
  assert.deepEqual(deleted,['farmacia-mvc-offline-v1','farmacia-mvc-offline-v2']);
});
