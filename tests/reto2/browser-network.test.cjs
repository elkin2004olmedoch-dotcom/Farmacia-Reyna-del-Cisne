const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {trackNetwork,settleNetwork}=require('../../scripts/browser-network.cjs');

const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const request=type=>({resourceType:()=>type});

test('la espera conserva peticiones finitas iniciadas antes y permite un EventSource abierto',async()=>{
  const page=new EventEmitter();trackNetwork(page);
  const stream=request('eventsource'),finite=request('fetch');
  page.emit('request',stream);page.emit('request',finite);
  const settling=settleNetwork(page,{idleMs:20,timeout:500});
  assert.equal(await Promise.race([settling.then(()=>true),wait(40).then(()=>false)]),false);
  page.emit('requestfinished',finite);
  await settling;
});

test('las solicitudes nuevas reinician la ventana de reposo y los fallos liberan la espera',async()=>{
  const page=new EventEmitter();trackNetwork(page);
  let settled=false;
  const settling=settleNetwork(page,{idleMs:60,timeout:500}).then(()=>{settled=true;});
  await wait(20);
  const finite=request('image');page.emit('request',finite);
  await wait(60);assert.equal(settled,false);
  page.emit('requestfailed',finite);
  await wait(20);assert.equal(settled,false);
  await settling;
});

test('una petición finita pendiente termina por timeout sin publicar su dirección',async()=>{
  const page=new EventEmitter();trackNetwork(page);
  page.emit('request',request('xhr'));
  await assert.rejects(settleNetwork(page,{idleMs:10,timeout:40}),{name:'TimeoutError'});
});

test('cerrar la página cancela la espera y el seguimiento repetido no duplica listeners',async()=>{
  const page=new EventEmitter();trackNetwork(page);trackNetwork(page);
  assert.equal(page.listenerCount('request'),1);
  page.emit('request',request('document'));
  const settling=settleNetwork(page,{idleMs:10,timeout:500});
  page.emit('close');
  await assert.rejects(settling,/cerrada/i);
  assert.equal(page.listenerCount('request'),0);
});
