const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {getEventListeners}=require('node:events');
let instance=0;

// Browser APIs are the boundary; the controller and existing role guard run unchanged.
class Element extends EventTarget {
  constructor(document,id='',dataset={}){super();Object.assign(this,{document,id,dataset,disabled:false,hidden:false,textContent:'',isConnected:true,attributes:new Map()});this.classList={toggle(){}};}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  focus(){this.document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  click(){return this.dispatchEvent(new Event('click'));}
}
async function browser(t,{userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0',standalone=false,secure=true,role=null}={}){
  const saved=new Map();
  let authModel,eventBus;
  function global(name,value){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
  const document=new EventTarget();document.nodes=new Map();
  document.getElementById=id=>document.nodes.get(id)||null;
  document.querySelectorAll=selector=>selector==='[data-app-open]'?[open]:selector==='[data-install-platform]'?platforms:[];
  document.body={dataset:{page:'home'}};
  const element=(id,dataset)=>{const node=new Element(document,id,dataset);document.nodes.set(id,node);return node;};
  for(const id of ['app-install-dialog','app-install-close','install-guidance','app-install-action','admin-install-action','admin-install-status','admin-area','page-status'])element(id);
  const open=element('open',{appOpen:''});
  const platforms=['android','ios','windows'].map(platform=>element(platform,{installPlatform:platform}));
  document.getElementById('admin-area').hidden=true;
  const window=new EventTarget();window.matchMedia=()=>({matches:standalone,addEventListener(){}});
  const registrations=[];const redirects=[];const storage=new Map();
  global('window',window);global('document',document);global('matchMedia',window.matchMedia);
  global('navigator',{userAgent,platform:/iPad/.test(userAgent)?'iPad':'',maxTouchPoints:0,standalone,serviceWorker:{register:async(...args)=>{registrations.push(args);}}});
  global('isSecureContext',secure);global('location',{origin:'https://farmacia.test',pathname:'/',assign:url=>redirects.push(url)});
  global('sessionStorage',{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)});
  global('localStorage',{getItem:()=>null,setItem(){}});
  t.after(()=>{
    if(eventBus)for(const name of ['session:changed','session:expired'])for(const listener of getEventListeners(eventBus,name))eventBus.removeEventListener(name,listener);
    authModel?.clear();
    for(const [name,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  });
  const filename=path.resolve('frontend/controllers/install.js');
  assert.ok(fs.existsSync(filename),'Falta el controlador de instalación MVC');
  const controller=await import(pathToFileURL(filename).href+'?test='+instance++);
  const {auth}=await import('../../frontend/models/auth.js');authModel=auth;auth.clear();
  eventBus=(await import('../../frontend/models/events.js')).events;
  if(role)auth.save({token:'synthetic',usuario:{id:'synthetic',role,nombre:'Prueba'}});
  return {controller,document,window,registrations,redirects,auth,open,platforms,node:id=>document.getElementById(id)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function offer(window,outcome='dismissed'){
  let prompts=0;
  const event=new Event('beforeinstallprompt',{cancelable:true});
  Object.assign(event,{prompt:async()=>{prompts++;},userChoice:Promise.resolve({outcome,platform:'web'})});
  window.dispatchEvent(event);return {event,prompts:()=>prompts};
}

test('la inicialización temprana es idempotente y devuelve foco al cerrar el diálogo',async t=>{
  const b=await browser(t);b.controller.installController();b.controller.installController();
  assert.equal(b.registrations.length,1);assert.deepEqual(b.registrations[0],['/app-worker.js',{scope:'/'}]);
  b.open.focus();b.open.click();assert.equal(b.node('app-install-dialog').open,true);
  b.node('app-install-close').click();assert.equal(b.node('app-install-dialog').open,false);assert.equal(b.document.activeElement,b.open);
  assert.equal(b.node('app-install-action').disabled,true);assert.match(b.node('install-guidance').textContent,/Edge|Chrome/);
});

test('sin HTTPS ni worker disponible se conserva una guía manual sin errores',async t=>{
  const b=await browser(t,{secure:false});delete navigator.serviceWorker;b.controller.installController();
  assert.equal(b.registrations.length,0);assert.equal(b.node('app-install-action').disabled,true);assert.match(b.node('install-guidance').textContent,/Chrome|Edge/);
});

test('iPhone muestra instrucciones de Safari y nunca ofrece un prompt para otra plataforma',async t=>{
  const b=await browser(t,{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Safari/605.1.15'});b.controller.installController();
  assert.match(b.node('install-guidance').textContent,/Safari/);assert.match(b.node('install-guidance').textContent,/Compartir/);assert.match(b.node('install-guidance').textContent,/pantalla de inicio/);
  offer(b.window);assert.equal(b.node('app-install-action').disabled,true);
  b.node('windows').click();assert.match(b.node('install-guidance').textContent,/Windows/);assert.equal(b.node('app-install-action').disabled,true);
});

test('elegir Android desde Windows da una guía para ese dispositivo sin instalar en el actual',async t=>{
  const b=await browser(t);b.controller.installController();const event=offer(b.window);
  assert.equal(b.node('app-install-action').disabled,false);assert.equal(event.event.defaultPrevented,true);assert.equal(event.prompts(),0);
  b.node('android').click();assert.match(b.node('install-guidance').textContent,/Android/);assert.equal(b.node('app-install-action').disabled,true);
  b.node('windows').click();assert.equal(b.node('app-install-action').disabled,false);
});

test('el botón oculto solo aparece para un prompt real en el dispositivo actual',async t=>{
  const b=await browser(t);const action=b.node('app-install-action');action.hidden=true;b.controller.installController();
  assert.equal(action.hidden,true);offer(b.window);assert.equal(action.hidden,false);assert.equal(action.disabled,false);
  b.node('android').click();assert.equal(action.hidden,true);assert.equal(action.disabled,true);
  b.node('ios').click();assert.equal(action.hidden,true);assert.equal(action.disabled,true);assert.match(b.node('install-guidance').textContent,/Safari/);
  b.node('windows').click();assert.equal(action.hidden,false);assert.equal(action.disabled,false);
  b.window.dispatchEvent(new Event('appinstalled'));assert.equal(action.hidden,true);assert.equal(action.disabled,true);
});

test('cancelar consume el prompt y permite reintentar solo cuando el navegador ofrece otro',async t=>{
  const b=await browser(t);b.controller.installController();const first=offer(b.window);
  b.node('app-install-action').click();await tick();assert.equal(first.prompts(),1);assert.equal(b.node('app-install-action').disabled,true);
  assert.match(b.node('install-guidance').textContent,/cancel|pospus/i);assert.doesNotMatch(b.node('install-guidance').textContent,/ya está instalada|se instaló/i);
  b.node('app-install-action').click();await tick();assert.equal(first.prompts(),1);
  const second=offer(b.window);assert.equal(b.node('app-install-action').disabled,false);b.node('app-install-action').click();await tick();assert.equal(second.prompts(),1);
});

test('aceptar la solicitud espera appinstalled antes de afirmar que está instalada',async t=>{
  const b=await browser(t);b.controller.installController();const native=offer(b.window,'accepted');
  b.node('app-install-action').click();await tick();assert.equal(native.prompts(),1);assert.equal(b.node('app-install-action').disabled,true);
  assert.doesNotMatch(b.node('install-guidance').textContent,/ya está instalada|se instaló/i);
  b.window.dispatchEvent(new Event('appinstalled'));assert.match(b.node('install-guidance').textContent,/confirmada por el dispositivo/i);assert.equal(b.node('app-install-action').disabled,true);
});

test('un fallo del prompt deja instrucciones y ningún rechazo sin manejar',async t=>{
  const b=await browser(t);b.controller.installController();const event=new Event('beforeinstallprompt',{cancelable:true});
  Object.assign(event,{prompt:async()=>{throw new Error('Browser unavailable');},userChoice:Promise.resolve({outcome:'dismissed'})});b.window.dispatchEvent(event);
  b.node('app-install-action').click();await tick();assert.equal(b.node('app-install-action').disabled,true);assert.match(b.node('install-guidance').textContent,/Chrome|Edge/);assert.doesNotMatch(b.node('install-guidance').textContent,/ya está instalada/);
});

test('standalone identifica la ventana y no afirma qué aplicación está instalada',async t=>{
  const b=await browser(t,{standalone:true});b.controller.installController();offer(b.window);
  assert.equal(b.node('app-install-action').disabled,true);assert.match(b.node('install-guidance').textContent,/ventana de aplicación/);assert.match(b.node('install-guidance').textContent,/navegador/);assert.doesNotMatch(b.node('install-guidance').textContent,/está instalada/i);
});

test('desde la tienda standalone la administración explica instalación separada en navegador',async t=>{
  const b=await browser(t,{standalone:true,role:'admin'});b.document.body.dataset.page='admin-install';b.controller.installController();b.controller.adminInstallController();offer(b.window);
  assert.equal(b.node('admin-install-action').disabled,true);assert.match(b.node('admin-install-status').textContent,/por separado/);assert.doesNotMatch(b.node('admin-install-status').textContent,/está instalada/i);
});

test('una app ya instalada conserva instrucciones al elegir otro dispositivo',async t=>{
  const b=await browser(t,{standalone:true});b.controller.installController();b.node('ios').click();
  assert.match(b.node('install-guidance').textContent,/Safari/);assert.match(b.node('install-guidance').textContent,/Compartir/);
});

test('la landing administrativa sin sesión vuelve al acceso con destino preservado',async t=>{
  const b=await browser(t);b.controller.installController();offer(b.window);b.controller.adminInstallController();
  assert.deepEqual(b.redirects,['cuenta.html?next=instalar-admin.html']);assert.equal(b.node('admin-area').hidden,true);assert.equal(b.node('admin-install-action').disabled,true);
});

for(const role of ['cliente','repartidor'])test(`el rol ${role} no habilita instalación administrativa`,async t=>{
  const b=await browser(t,{role});b.controller.installController();offer(b.window);b.controller.adminInstallController();
  assert.equal(b.node('admin-area').hidden,true);assert.equal(b.node('admin-install-action').disabled,true);assert.match(b.node('page-status').textContent,/administradores/);
});

test('admin autorizado instala solo con prompt real y se comprueba el rol otra vez al pulsar',async t=>{
  const b=await browser(t,{role:'admin'});b.controller.installController();b.controller.adminInstallController();b.controller.adminInstallController();
  assert.equal(b.node('admin-area').hidden,false);assert.equal(b.node('admin-install-action').disabled,true);assert.match(b.node('admin-install-status').textContent,/Edge|Chrome/);
  const native=offer(b.window);assert.equal(b.node('admin-install-action').disabled,false);
  b.auth.clear();b.node('admin-install-action').click();await tick();assert.equal(native.prompts(),0);assert.equal(b.node('admin-install-action').disabled,true);
  assert.deepEqual(b.redirects,['cuenta.html?next=instalar-admin.html']);
});

test('admin conserva guía tras cancelar sin afirmar que está instalado',async t=>{
  const b=await browser(t,{role:'admin'});b.controller.installController();b.controller.adminInstallController();const native=offer(b.window);
  b.node('admin-install-action').click();await tick();assert.equal(native.prompts(),1);assert.equal(b.node('admin-install-action').disabled,true);
  assert.match(b.node('admin-install-status').textContent,/cancel|pospus/i);assert.doesNotMatch(b.node('admin-install-status').textContent,/ya está instalada|se instaló/i);
});

for(const name of ['session:changed','session:expired'])test(`${name} retira el instalador administrativo al perder la sesión`,async t=>{
  const b=await browser(t,{role:'admin'});b.controller.installController();b.controller.adminInstallController();offer(b.window);
  const {events}=await import('../../frontend/models/events.js');if(name==='session:changed')b.auth.clear();else events.dispatchEvent(new Event(name));
  assert.equal(b.node('admin-area').hidden,true);assert.equal(b.node('admin-install-action').disabled,true);
});
