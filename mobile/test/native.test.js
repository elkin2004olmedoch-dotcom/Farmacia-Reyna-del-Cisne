import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRuntime} from '../src/native.js';

function dependencies(platform='ios'){
  const calls=[];
  const storage={async setSynchronize(value){calls.push(['sync',value]);},async setDefaultKeychainAccess(value){calls.push(['access',value]);},async setKeyPrefix(value){calls.push(['prefix',value]);},async get(...args){calls.push(['get',...args]);return null;},async set(...args){calls.push(['set',...args]);},async remove(...args){calls.push(['remove',...args]);}};
  const http={async request(options){calls.push(['http',options]);return {status:200,data:{ok:true,data:{value:1}}};}};
  const notifications={async checkPermissions(){return {display:'prompt'};},async requestPermissions(){calls.push(['notification']);return {display:'granted'};}};
  return {platform,calls,secureStorage:storage,http,notifications,gps:{async openSettings(){calls.push(['settings']);}},random:{getRandomValues(bytes){bytes.fill(7);return bytes;}}};
}
test('fuera de Android/iOS no toca almacenamiento ni ofrece fallback web',async()=>{
  const dependenciesForWeb=dependencies('web');
  await assert.rejects(()=>createNativeRuntime(dependenciesForWeb),error=>error.code==='NATIVE_REQUIRED');assert.deepEqual(dependenciesForWeb.calls,[]);
});
test('Keychain permite renovar bloqueado tras primer desbloqueo, sin iCloud ni migración',async()=>{
  const options=dependencies(),runtime=await createNativeRuntime(options);
  assert(options.calls.some(call=>call[0]==='sync'&&call[1]===false));assert(options.calls.some(call=>call[0]==='access'&&call[1]===3));
  await runtime.storage.set('farmacia.reparto.session.v1',{refreshToken:'synthetic'});await runtime.storage.get('farmacia.reparto.session.v1');await runtime.storage.remove('farmacia.reparto.session.v1');
  assert(options.calls.some(call=>call[0]==='get'&&call[2]===false&&call[3]===false));
});
test('HTTP nativo fija origen, conserva envelope y bloquea hosts/rutas ajenos',async()=>{
  const options=dependencies('android'),runtime=await createNativeRuntime(options);
  assert.deepEqual(await runtime.transport('/entregas?page=1',{token:'synthetic.jwt.token'}),{status:200,body:{ok:true,data:{value:1}}});
  const request=options.calls.find(call=>call[0]==='http')[1];assert.equal(request.url,'https://farmacia-reina-del-cisne.onrender.com/api/entregas?page=1');assert.equal(request.disableRedirects,true);assert.equal(request.headers.Authorization,'Bearer synthetic.jwt.token');
  for(const path of ['https://outside.example/api','//outside.example','/../private','/path#fragment','/bad\\path'])await assert.rejects(()=>runtime.transport(path));
  await assert.rejects(()=>runtime.transport('/entregas',{token:'bad\r\ntoken'}));
});
test('red y JSON inválido producen errores sin cuerpo ni credenciales',async()=>{
  const options=dependencies(),runtime=await createNativeRuntime(options);options.http.request=async()=>{throw new Error('sensitive body synthetic.jwt.token');};
  await assert.rejects(()=>runtime.transport('/entregas'),error=>error.code==='NETWORK_ERROR'&&!error.message.includes('sensitive'));
  options.http.request=async()=>({status:200,data:'not-json-sensitive'});await assert.rejects(()=>runtime.transport('/entregas'),error=>error.code==='INVALID_RESPONSE'&&!error.message.includes('sensitive'));
});
test('Android exige permiso visible de notificación; iOS no solicita permiso innecesario',async()=>{
  const options=dependencies('android'),runtime=await createNativeRuntime(options);assert.equal(await runtime.ensureNotifications(),true);assert(options.calls.some(call=>call[0]==='notification'));
  options.notifications.requestPermissions=async()=>({display:'denied'});await assert.rejects(()=>runtime.ensureNotifications(),error=>error.code==='NOTIFICATIONS_DENIED');
  const ios=dependencies(),iosRuntime=await createNativeRuntime(ios);await iosRuntime.ensureNotifications();assert(!ios.calls.some(call=>call[0]==='notification'));
});
test('secretos aleatorios usan getRandomValues y se puede abrir configuración nativa',async()=>{
  const options=dependencies(),runtime=await createNativeRuntime(options);assert.deepEqual(runtime.randomBytes(32),new Uint8Array(32).fill(7));assert.throws(()=>runtime.randomBytes(0));await runtime.openSettings();assert(options.calls.some(call=>call[0]==='settings'));
});

test('vista previa obtiene GPS nativo y retira su observador incluso si el permiso se deniega',async()=>{
 for(const denied of [false,true]){
  const options=dependencies('android'),removed=[];
  options.gps.addWatcher=async(values,callback)=>{assert.equal(values.requestPermissions,true);callback(denied?null:{latitude:.12,longitude:-79.24,time:Date.now()},denied?{code:'NOT_AUTHORIZED'}:undefined);return 'preview';};
  options.gps.removeWatcher=async({id})=>removed.push(id);
  const runtime=await createNativeRuntime(options);
  if(denied)await assert.rejects(()=>runtime.locate(),error=>error.code==='NOT_AUTHORIZED');else assert.equal((await runtime.locate()).latitud,.12);
  assert.deepEqual(removed,['preview']);
 }
});
