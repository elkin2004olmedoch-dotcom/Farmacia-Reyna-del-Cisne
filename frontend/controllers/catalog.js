import {catalog} from '../models/catalog.js';
import {cart} from '../models/cart.js';
import {catalogView,productView,promotionView,comparisonView} from '../views/products.js';
import {message,busy} from '../views/common.js';
import {watchUpdates,preserveFocus} from './updates.js';
import {predictiveSearch} from './predictive-search.js';
import {connectFavorites} from './customer-account.js';
import {reviewsController} from './reviews.js';
const selected=()=>{try{return JSON.parse(sessionStorage.getItem('farmacia-mvc-comparacion') || '[]').filter(id=>typeof id==='string').slice(0,4);}catch(_){return [];}};
function actions(target) {
  connectFavorites(target);
  target.addEventListener('click',async event=>{const button=event.target.closest('[data-add]');if(!button || button.disabled)return;const wasFocused=document.activeElement===button;busy(button,true);try{const product=await catalog.find(button.dataset.add);cart.add(product);message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}finally{if(button.isConnected){busy(button,false);if(wasFocused && !document.querySelector('dialog[open]'))button.focus();}}});
  target.addEventListener('change',event=>{if(!event.target.matches('[data-compare]'))return;let chosen=selected();if(event.target.checked){if(chosen.length>=4){event.target.checked=false;message('Puedes comparar hasta cuatro productos.',true);return;}chosen.push(event.target.dataset.compare);}else chosen=chosen.filter(id=>id!==event.target.dataset.compare);sessionStorage.setItem('farmacia-mvc-comparacion',JSON.stringify(chosen));});
  for(const field of target.querySelectorAll('[data-compare]'))field.checked=selected().includes(field.dataset.compare);
}
export async function homeController() {
  let products,promotions;const target=document.getElementById('featured-products');actions(target);
  const refreshProducts=watchUpdates(async()=>{
    try{
      const loaded=await catalog.featured();
      if(JSON.stringify(loaded)!==JSON.stringify(products)){products=loaded;preserveFocus(target,()=>{catalogView(products.slice(0,4),target);for(const input of target.querySelectorAll('[data-compare]'))input.checked=selected().includes(input.dataset.compare);});}
    }catch(error){if(products===undefined)target.textContent=error.message;throw error;}
  });
  const refreshPromotions=watchUpdates(async()=>{
    try{const loaded=await catalog.promotions();if(JSON.stringify(loaded)!==JSON.stringify(promotions)){promotions=loaded;preserveFocus(document.getElementById('promotions-list'),()=>promotionView(promotions));}}
    catch(error){document.getElementById('promotions-note').textContent=error.message;throw error;}
  });
  void refreshProducts();void refreshPromotions();
}
export async function catalogController() {
  const target=document.getElementById('catalog-grid'),count=document.getElementById('catalog-count'),errorPanel=document.getElementById('catalog-error');
  const fields={q:document.getElementById('catalog-search'),category:document.getElementById('catalog-category'),sort:document.getElementById('catalog-sort'),laboratorio:document.getElementById('catalog-laboratory'),presentacion:document.getElementById('catalog-presentation')};
  const prev=document.getElementById('catalog-prev'),next=document.getElementById('catalog-next'),pageInfo=document.getElementById('catalog-page-info');
  for(const button of [prev,next]){button.disabled=false;button.setAttribute('aria-disabled','true');}
  let page=1,total=0,controller,version=0,timer,loadedItems;
  function readRoute(){
    const route=new URLSearchParams(location.search);
    fields.q.value=(route.get('q') || '').slice(0,100);
    fields.category.value=['bienestar','cuidado','bebe'].includes(route.get('category'))?route.get('category'):'todos';
    fields.sort.value=['low','high'].includes(route.get('sort'))?route.get('sort'):'recommended';
    for(const key of ['laboratorio','presentacion']){
      const value=(route.get(key)||'').slice(0,120);
      if(value && ![...fields[key].options].some(option=>option.value===value))fields[key].add(new Option(value,value));
      fields[key].value=value;
    }
    page=Math.min(100000,Math.max(1,Number.parseInt(route.get('page'),10)||1));
  }
  function writeRoute(){
    const route=new URLSearchParams(location.search);
    for(const [key,field] of Object.entries(fields)){
      const value=field.value.trim(),fallback=key==='category'?'todos':key==='sort'?'recommended':'';
      if(value===fallback)route.delete(key);else route.set(key,value);
    }
    if(page===1)route.delete('page');else route.set('page',String(page));
    const search=route.toString();history.replaceState(null,'',location.pathname+(search?'?'+search:'')+location.hash);
    document.getElementById('global-search').value=fields.q.value;
  }
  const filters=()=>({...(fields.category.value!=='todos'?{categoria:fields.category.value}:{}),...(fields.laboratorio.value?{laboratorio:fields.laboratorio.value}:{}),...(fields.presentacion.value?{presentacion:fields.presentacion.value}:{})});
  const predictive=predictiveSearch(fields.q,{filters});
  function cancel(){clearTimeout(timer);timer=null;controller?.abort();version++;}
  async function load({silent=false}={}){
    cancel();const current=version;controller=new AbortController();errorPanel.hidden=true;target.setAttribute('aria-busy','true');prev.setAttribute('aria-disabled','true');next.setAttribute('aria-disabled','true');
    if(!silent)count.textContent='Buscando productos…';
    try{
      const result=await catalog.page({q:fields.q.value.trim(),...filters(),sort:fields.sort.value,page,pageSize:24},{signal:controller.signal});
      if(current!==version)return;
      total=result.total;const pages=Math.max(1,Math.ceil(total/24));
      if(page>pages){page=pages;writeRoute();return await load({silent});}
      if(JSON.stringify(loadedItems)!==JSON.stringify(result.items)){
        loadedItems=result.items;preserveFocus(target,()=>{catalogView(result.items,target);for(const input of target.querySelectorAll('[data-compare]'))input.checked=selected().includes(input.dataset.compare);});
      }
      delete target.dataset.loading;
      count.textContent=total?`${total} productos encontrados · Mostrando ${(page-1)*24+1}–${Math.min(page*24,total)}`:'No hay productos con estos filtros.';
      pageInfo.textContent=`Página ${page} de ${pages}`;
    }catch(error){
      if(current!==version || error.name==='AbortError')return;
      errorPanel.querySelector('span').textContent=error.message;errorPanel.hidden=false;count.textContent='No se pudieron actualizar los resultados.';
      if(loadedItems===undefined){target.replaceChildren();delete target.dataset.loading;}
      if(silent)throw error;
    }finally{if(current===version){target.setAttribute('aria-busy','false');prev.setAttribute('aria-disabled',String(page<=1));next.setAttribute('aria-disabled',String(page*24>=total));}}
  }
  function change(){cancel();page=1;writeRoute();void load();}
  fields.q.addEventListener('input',()=>{cancel();page=1;writeRoute();timer=setTimeout(()=>{timer=null;void load();},260);});
  for(const field of Object.values(fields).filter(field=>field!==fields.q))field.addEventListener('change',()=>{predictive.close();change();});
  document.getElementById('catalog-filter-form').addEventListener('submit',event=>{event.preventDefault();predictive.close();change();});
  document.getElementById('catalog-clear').addEventListener('click',()=>{for(const [key,field] of Object.entries(fields))field.value=key==='category'?'todos':key==='sort'?'recommended':'';predictive.close();change();message('Filtros restablecidos.');});
  document.getElementById('catalog-retry').addEventListener('click',()=>void load());
  for(const [button,delta] of [[prev,-1],[next,1]])button.addEventListener('click',()=>{if(button.getAttribute('aria-disabled')==='true')return;page+=delta;writeRoute();void load();});
  readRoute();writeRoute();actions(target);
  void catalog.facets().then(facets=>{
    for(const [key,values,container] of [['laboratorio',facets.laboratorios,'catalog-laboratory-filter'],['presentacion',facets.presentaciones,'catalog-presentation-filter']]){
      const field=fields[key];for(const value of values)if(![...field.options].some(option=>option.value===value))field.add(new Option(value,value));
      document.getElementById(container).hidden=!values.length && !field.value;
    }
  }).catch(()=>{/* Search and category filters remain usable when facets are temporarily unavailable. */});
  await load();
  window.addEventListener('popstate',()=>{cancel();readRoute();writeRoute();predictive.close();void load();});
  window.addEventListener('pagehide',cancel);
  window.addEventListener('pageshow',event=>{if(event.persisted)void load();});
  watchUpdates(()=>load({silent:true}),{canRefresh:()=>!timer && target.getAttribute('aria-busy')!=='true'});
}
export async function productController() {
  const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('Selecciona un producto desde el catálogo.');let product=await catalog.find(id);const target=document.getElementById('product-detail');
  function render(){const quantity=document.getElementById('detail-quantity')?.value || '1';preserveFocus(target,()=>{productView(product);document.getElementById('detail-quantity').value=quantity;});document.title=product.nombre+' | Farmacia Reina del Cisne';}
  render();connectFavorites(target);reviewsController(id);
  target.addEventListener('click',event=>{const quantity=document.getElementById('detail-quantity');const button=event.target.closest('[data-quantity]');if(button)quantity.value=Math.min(Number(quantity.max),Math.max(1,Number(quantity.value)+Number(button.dataset.quantity)));if(event.target.closest('#zoom-product')){const dialog=document.getElementById('image-dialog');const image=dialog.querySelector('img');image.src=target.querySelector('#zoom-product img').src;image.alt=product.alt || product.nombre;dialog.showModal();}});
  target.addEventListener('submit',async event=>{event.preventDefault();const quantity=Number(document.getElementById('detail-quantity').value);const button=event.target.querySelector('[type=submit]');const wasFocused=document.activeElement===button;busy(button,true);try{product=await catalog.find(id);cart.add(product,quantity);message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}finally{render();if(wasFocused && !document.querySelector('dialog[open]'))document.getElementById('detail-add-button')?.focus();}});
  watchUpdates(async()=>{try{const loaded=await catalog.find(id);if(JSON.stringify(loaded)!==JSON.stringify(product)){product=loaded;render();}}catch(error){if(error.status===404){target.innerHTML='<p class="shop-empty">Este producto fue retirado del catálogo. <a href="catalogo.html">Ver productos disponibles</a></p>';}throw error;}},{canRefresh:()=>!document.querySelector('dialog[open]') && document.activeElement?.id!=='detail-quantity' && !target.querySelector('[aria-busy=true]')});
}
export async function compareController() {
  let products=await catalog.all();let chosen=selected().filter(id=>products.some(p=>p.id===id));if(!chosen.length)chosen=products.slice(0,4).map(p=>p.id);comparisonView(products,chosen);
  document.getElementById('compare-picks').addEventListener('change',event=>{if(!event.target.matches('[data-pick]'))return;const next=[...document.querySelectorAll('[data-pick]:checked')].map(field=>field.dataset.pick);if(next.length>4){event.target.checked=false;message('Puedes comparar hasta cuatro productos.',true);return;}chosen=next;sessionStorage.setItem('farmacia-mvc-comparacion',JSON.stringify(chosen));comparisonView(products,chosen);document.querySelector(`[data-pick="${event.target.dataset.pick}"]`)?.focus();});
  watchUpdates(async()=>{const loaded=await catalog.all();if(JSON.stringify(loaded)!==JSON.stringify(products)){products=loaded;chosen=chosen.filter(id=>products.some(product=>product.id===id));preserveFocus(document.getElementById('compare-picks'),()=>comparisonView(products,chosen));}});
}
