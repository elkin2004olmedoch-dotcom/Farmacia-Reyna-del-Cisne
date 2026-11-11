const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const document=new EventTarget(),window=new EventTarget(),events=new EventTarget(),sources=[],timers=[];
 document.hidden=false;document.getElementById=()=>({textContent:''});
 class EventSource{constructor(){sources.push(this);}close(){this.closed=true;}}
 const context={document,window,events,EventSource,apiUrl:path=>path,message:()=>{},setInterval:()=>1,clearInterval:()=>{},setTimeout:callback=>{timers.push(callback);return timers.length;},clearTimeout:()=>{},console};
 let source=fs.readFileSync(path.resolve(__dirname,'../../frontend/controllers/updates.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export function /g,'function ');
 vm.runInNewContext(source+'\nglobalThis.watch=watchUpdates;',context);return {document,window,events,sources,timers,watch:context.watch};
}
test('una sola conexión compartida se cierra al ocultar y al abandonar la página',()=>{
 const state=setup();state.watch(async()=>{});state.watch(async()=>{});assert.equal(state.sources.length,1);
 state.document.hidden=true;state.document.dispatchEvent(new Event('visibilitychange'));assert.equal(state.sources[0].closed,true);
 state.document.hidden=false;state.document.dispatchEvent(new Event('visibilitychange'));assert.equal(state.sources.length,2);
 state.window.dispatchEvent(new Event('pagehide'));assert.equal(state.sources[1].closed,true);
});
test('el cambio bloqueado por un editor se recupera al cerrar sin esperar el intervalo',async()=>{
 const state=setup();let allowed=false,calls=0;state.watch(async()=>{calls++;},{canRefresh:()=>allowed});
 state.sources[0].onmessage({data:JSON.stringify({revision:'a'.repeat(32)})});await Promise.resolve();assert.equal(calls,0);
 allowed=true;state.document.dispatchEvent(new Event('close'));await Promise.resolve();assert.equal(calls,1);
});
test('fallar el canal cierra y programa una reconexión acotada sin perder el fallback',()=>{
 const state=setup();state.watch(async()=>{});assert.equal(typeof state.sources[0].onerror,'function');state.sources[0].onerror();assert.equal(state.sources[0].closed,true);assert.equal(state.timers.length,1);
 state.timers[0]();assert.equal(state.sources.length,2);state.window.dispatchEvent(new Event('pagehide'));
});
test('la revisión inicial comprueba consistencia y su repetición tras reconectar no duplica lecturas',async()=>{
 const state=setup();let calls=0;state.watch(async()=>{calls++;});
 const event={data:JSON.stringify({revision:'a'.repeat(32)})};
 state.sources[0].onmessage(event);await Promise.resolve();assert.equal(calls,1);
 state.sources[0].onmessage(event);await Promise.resolve();assert.equal(calls,1);
 state.sources[0].onerror();state.timers[0]();state.sources[1].onmessage(event);await Promise.resolve();assert.equal(calls,1);
 state.window.dispatchEvent(new Event('pagehide'));
});
test('una lectura ocupada recupera el aviso pendiente al quedar disponible',async()=>{
 const state=setup();let allowed=false,calls=0;state.watch(async()=>{calls++;},{canRefresh:()=>allowed});
 state.sources[0].onmessage({data:JSON.stringify({revision:'a'.repeat(32)})});await Promise.resolve();assert.equal(calls,0);assert.equal(state.timers.length,1);
 allowed=true;state.timers[0]();await Promise.resolve();assert.equal(calls,1);state.window.dispatchEvent(new Event('pagehide'));
});
