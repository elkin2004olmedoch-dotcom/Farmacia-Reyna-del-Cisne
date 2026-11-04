'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
 constructor(id=''){this.id=id;this.dataset={};this.attributes={};this.handlers={};this.children=[];this.queries={};this.textContent='';this.value='';this.isConnected=true;}
 addEventListener(name,handler){(this.handlers[name]||=[]).push(handler);}
 dispatchEvent(event){for(const handler of this.handlers[event.type]||[])handler(event);return true;}
 async emit(name,event={}){for(const handler of this.handlers[name]||[])await handler({preventDefault(){},...event});}
 append(...nodes){this.children.push(...nodes);}prepend(node){this.children.unshift(node);}after(){}
 replaceChildren(...nodes){this.children=nodes;}setAttribute(name,value){this.attributes[name]=value;}removeAttribute(name){delete this.attributes[name];}
 querySelector(selector){return this.queries[selector]||null;}querySelectorAll(){return [];}
 remove(){this.isConnected=false;}close(){this.remove();}focus(){}showModal(){}
}
function harness(file,overrides={}){
 const elements=new Map(),body=new Element('body'),messages=[],auth={user:{id:'account-a',role:'user'}},events=new EventTarget();
 const document={body,createElement:()=>{const node=new Element();body.children.push(node);return node;},getElementById:id=>elements.get(id)||body.children.find(node=>node.id===id&&node.isConnected)||null,querySelectorAll:()=>[]};
 const sandbox={auth,events,document,window:{addEventListener(){}},Event,Option:class extends Element{constructor(text,value){super();this.textContent=text;this.value=value;}},MutationObserver:class{observe(){}disconnect(){}},customerAccount:{favorites:async()=>[],...overrides},cart:{read:()=>({}),write(){}},mergeReorder(){},accountPanels(){},addressList(){},favoritesList(){},reorderView(){},busy:(node,value)=>{node.disabled=value;},message:text=>messages.push(text),confirmAction:async()=>true};
 const source=fs.readFileSync('frontend/controllers/'+file,'utf8').replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'');
 vm.runInNewContext(source,sandbox,{filename:file});
 return {sandbox,elements,body,messages,auth,events,document,switchUser(){auth.user={id:'account-b',role:'user'};events.dispatchEvent(new Event('session:changed'));}};
}
function addressForm(){const form=new Element();form.elements=Object.fromEntries(['province','city','address','postalCode'].map(field=>[field,new Element()]));form.queries['[name=delivery][value=delivery]']=new Element();return form;}
test('dirección tardía de A se descarta si cambia a otra cuenta user',async()=>{
 const pending=deferred(),h=harness('customer-account.js',{addresses:()=>pending.promise}),form=addressForm();
 const loading=h.sandbox.connectSavedAddresses(form,{ready:Promise.resolve(),reset(){}});h.switchUser();pending.resolve([{id:'private-a',alias:'Casa privada A',ciudad:'Quito'}]);await loading;
 assert.equal(form.children[0].isConnected,false,'se retira el selector que pertenece a A');
 assert.ok(!form.children[0].children[1].children.some(option=>option.textContent.includes('privada A')),'no presenta opciones de A a B');
});
test('selección de dirección no rellena datos de A tras esperar cobertura y cambiar a B',async()=>{
 const ready=deferred(),h=harness('customer-account.js',{addresses:async()=>[{id:'private-a',alias:'Casa A',ciudad:'Quito',provincia:'Pichincha',direccion:'Dirección privada A'}]}),form=addressForm();let resets=0;
 await h.sandbox.connectSavedAddresses(form,{ready:ready.promise,reset(){resets++;}});const select=form.children[0].children[1];select.value='private-a';const selecting=select.emit('change');h.switchUser();ready.resolve();await selecting;
 assert.equal(form.elements.address.value,'');assert.equal(resets,0);
});
test('propuesta de recompra tardía de A no abre diálogo para B',async()=>{
 const pending=deferred(),h=harness('customer-account.js',{reorder:()=>pending.promise}),target=new Element(),button=new Element();button.dataset.reorder='order-a';let rendered=0;
 h.sandbox.reorderView=dialog=>{rendered++;dialog.queries['[data-reorder-cancel]']=new Element();};h.sandbox.connectReorder(target);
 const opening=target.emit('click',{target:{closest:()=>button}});h.switchUser();pending.resolve({pedidoId:'order-a',items:[]});await opening;
 assert.equal(rendered,0);assert.equal(h.document.getElementById('reorder-dialog'),null);
});
test('mutación tardía de favoritos de A no marca el favorito ni anuncia éxito a B',async()=>{
 const pending=deferred(),h=harness('customer-account.js',{favorite:()=>pending.promise}),target=new Element(),button=new Element();button.dataset.favorite='product-a';button.textContent='♡ Favorito';target.querySelectorAll=()=>[button];h.document.querySelectorAll=()=>[button];
 h.sandbox.connectFavorites(target);await flush();const changing=target.emit('click',{target:{closest:()=>button}});await flush();h.switchUser();pending.resolve();await changing;
 assert.equal(button.attributes['aria-pressed'],'false');assert.equal(h.messages.length,0);
});
function reviewHarness(overrides={}){
 const h=harness('reviews.js'),root=new Element('product-reviews'),list=new Element(),own=new Element(),status=new Element(),button=new Element('review-remove');root.queries={'#reviews-list':list,'#review-own':own};own.queries['#review-status']=status;h.elements.set('product-detail',new Element());h.sandbox.reviewPanel=()=>root;h.sandbox.reviewList=()=>{};h.sandbox.ownReview=(target,values)=>{target.renderedReview=values.resena.id;status.textContent='';};h.sandbox.customerAccount={reviews:async()=>({items:[],total:0}),eligibility:async()=>({detalleId:'detail-'+h.auth.user.id,resena:{id:'review-'+h.auth.user.id}}),removeReview:async()=>{},...overrides};h.sandbox.reviewsController('product-a');return {...h,root,list,own,status,button};
}
test('retirar reseña captura cuenta y reseña antes del modal y cancela al cambiar a B',async()=>{
 const confirmation=deferred(),removed=[],h=reviewHarness({removeReview:async id=>removed.push(id)});h.sandbox.confirmAction=()=>confirmation.promise;await flush();
 const withdrawing=h.own.emit('click',{target:{closest:()=>h.button}});h.switchUser();await flush();assert.equal(h.own.renderedReview,'review-account-b');confirmation.resolve(true);await withdrawing;
 assert.deepEqual(removed,[]);assert.notEqual(h.status.textContent,'Reseña retirada.');
});
test('respuesta de retirar reseña de A no cambia estado privado ni refresca elegibilidad de B',async()=>{
 const pending=deferred(),h=reviewHarness({removeReview:()=>pending.promise});await flush();const withdrawing=h.own.emit('click',{target:{closest:()=>h.button}});await flush();h.switchUser();await flush();pending.resolve();await withdrawing;
 assert.equal(h.own.renderedReview,'review-account-b');assert.notEqual(h.status.textContent,'Reseña retirada.');
});
