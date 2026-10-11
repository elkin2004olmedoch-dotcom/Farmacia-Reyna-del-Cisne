const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function environment({stored=new Map(),session=new Map(),blockSession=false}={}) {
  const area=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)});
  const sessionArea=blockSession?{getItem(){throw new Error('Storage blocked');},setItem(){throw new Error('Storage blocked');}}:area(session);
  const ctx=vm.createContext({crypto:webcrypto,TextEncoder,localStorage:area(stored),sessionStorage:sessionArea,Farmacia:{validation:require('../js/validation'),cart:require('../js/cart'),view:{money:n=>'$'+(n/100).toFixed(2)},storage:{saveCart:items=>stored.set('cart',JSON.stringify(items))}}});
  vm.runInContext(fs.readFileSync('js/commerce.js','utf8'),ctx);
  return { api:ctx.Farmacia.commerce,stored,session };
}
const profile={name:'Cliente',surname:'Prueba',email:'cliente@example.ec',phone:'0979275988',cedula:'0102030400',password:'Prueba123',confirm:'Prueba123',terms:true};
const products=[{id:'a',name:'Producto',image:'assets/images/producto-vitaminas.jpg',price:12.5}];
const buyer={name:'Cliente Prueba',email:'cliente@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup'};
test('cuenta local usa hash con sal, no conserva contraseña ni cédula y valida acceso',async()=>{
  const {api,stored}=environment(); await api.register(profile);
  const raw=stored.get('farmacia-shop-accounts'); assert.ok(!raw.includes('Prueba123')); assert.ok(!raw.includes('0102030400'));
  assert.equal(api.currentUser().phone,'+593979275988');
  await assert.rejects(()=>api.register(profile),/ya tiene una cuenta/);
  api.logout(); assert.equal(api.currentUser(),null);
  await assert.rejects(()=>api.login(profile.email,'Incorrecta123'),/no coinciden/);
  await api.login('CLIENTE@example.ec','Prueba123'); assert.equal(api.currentUser().name,'Cliente');
});

test('registro conserva la cuenta y avisa si no puede guardar la sesión sin activar una sesión temporal',async()=>{
  const {api,stored,session}=environment({blockSession:true});
  await assert.rejects(()=>api.register(profile),/Tu cuenta se guardó.*no permitió guardar la sesión/);
  assert.equal(api.currentUser(),null);
  assert.equal(JSON.parse(stored.get('farmacia-shop-accounts')).length,1);
  const afterNavigation=environment({stored,session,blockSession:true});
  assert.equal(afterNavigation.api.currentUser(),null);
  const enabled=environment({stored,session});
  await enabled.api.login(profile.email,profile.password);
  assert.equal(enabled.api.currentUser().email,profile.email);
});

test('login con contraseña correcta rechaza una sesión bloqueada y permite reintentarlo al habilitar almacenamiento',async()=>{
  const {api,stored,session}=environment();
  await api.register(profile);api.logout();
  const blocked=environment({stored,session,blockSession:true});
  await assert.rejects(()=>blocked.api.login(profile.email,profile.password),/no permitió guardar tu sesión/);
  assert.equal(blocked.api.currentUser(),null);
  assert.equal(environment({stored,session,blockSession:true}).api.currentUser(),null);
  const enabled=environment({stored,session});
  await enabled.api.login(profile.email,profile.password);
  assert.equal(enabled.api.currentUser().email,profile.email);
});
test('registro de pedido valida datos y no guarda ni envía PAN, CVV, vencimiento o documento completo',()=>{
  const {api,stored}=environment(); const card={holder:'Cliente Prueba',cardNumber:'4000 0021 8000 0000',expiry:'12/34',cvv:'987'};
  const order=api.createOrder({a:2},products,buyer,'card',card);
  assert.equal(order.totalCents,2500); assert.equal(order.payment.last4,'0000'); assert.equal(order.payment.status,'simulated');
  const raw=stored.get('farmacia-shop-orders'); for(const sensitive of ['4000 0021 8000 0000','4000002180000000','987','12/34','0102030400']) assert.ok(!raw.includes(sensitive),sensitive);
  const message=api.whatsappMessage(order); assert.ok(!message.includes('0102030400')); assert.ok(!message.includes(card.cardNumber));
  assert.equal(stored.get('cart'),'{}'); assert.equal(api.orders().length,1);
  assert.throws(()=>api.createOrder({},products,buyer,'store'),/vacío/);
  assert.throws(()=>api.createOrder({a:1},products,{...buyer,document:'1234567890'},'store'),/comprador/);
  assert.throws(()=>api.createOrder({a:1},products,buyer,'card',{...card,cardNumber:'4000000000000002'}),/tarjetas de prueba/);
});
test('pedidos de cuentas se separan y cerrar sesión no muestra el historial de otro usuario',async()=>{
  const {api}=environment(); await api.register(profile); api.createOrder({a:1},products,buyer,'store'); assert.equal(api.orders().length,1);
  api.logout(); assert.equal(api.orders().length,0);
  await api.register({...profile,email:'otro@example.ec'}); assert.equal(api.orders().length,0);
});
