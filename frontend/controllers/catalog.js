import {catalog} from '../models/catalog.js';
import {publicImageUrl} from '../config.js';
import {cart} from '../models/cart.js';
import {catalogView,productView,promotionView,comparisonView} from '../views/products.js';
import {message,busy} from '../views/common.js';
import {watchUpdates,preserveFocus} from './updates.js';
const selected=()=>{try{return JSON.parse(sessionStorage.getItem('farmacia-mvc-comparacion') || '[]').filter(id=>typeof id==='string').slice(0,4);}catch(_){return [];}};
function actions(target) {
  target.addEventListener('click',async event=>{const button=event.target.closest('[data-add]');if(!button || button.disabled)return;const wasFocused=document.activeElement===button;busy(button,true);try{const product=await catalog.find(button.dataset.add);cart.add(product);message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}finally{if(button.isConnected){busy(button,false);if(wasFocused)button.focus();}}});
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
  let products=await catalog.all();const target=document.getElementById('catalog-grid');const query=document.getElementById('catalog-search');const category=document.getElementById('catalog-category');const sort=document.getElementById('catalog-sort');
  function readRoute(){
    const route=new URLSearchParams(location.search);
    query.value=(route.get('q') || '').slice(0,100);
    category.value=['bienestar','cuidado','bebe'].includes(route.get('category'))?route.get('category'):'todos';
    sort.value=['low','high'].includes(route.get('sort'))?route.get('sort'):'recommended';
  }
  function writeRoute(){
    const route=new URLSearchParams(location.search);
    for(const [key,value,fallback] of [['q',query.value.trim(),''],['category',category.value,'todos'],['sort',sort.value,'recommended']]){
      if(value===fallback)route.delete(key);else route.set(key,value);
    }
    const search=route.toString();history.replaceState(null,'',location.pathname+(search?'?'+search:'')+location.hash);
  }
  readRoute();
  const normalize=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  function render(){writeRoute();const headerQuery=document.getElementById('global-search');if(headerQuery)headerQuery.value=query.value;let visible=products.filter(p=>(category.value==='todos' || p.categoria===category.value) && normalize(p.nombre+' '+p.descripcion).includes(normalize(query.value.trim())));if(sort.value!=='recommended')visible.sort((a,b)=>(Number(a.precio)-Number(b.precio))*(sort.value==='low'?1:-1));catalogView(visible,target);document.getElementById('catalog-count').textContent=`${visible.length} productos encontrados`;for(const input of target.querySelectorAll('[data-compare]'))input.checked=selected().includes(input.dataset.compare);}
  for(const input of [query,category,sort])input.addEventListener(input===query?'input':'change',render);
  document.getElementById('catalog-clear').addEventListener('click',()=>{query.value='';category.value='todos';sort.value='recommended';render();message('Filtros restablecidos.');});render();actions(target);
  window.addEventListener('popstate',()=>{readRoute();preserveFocus(target,render);});
  watchUpdates(async()=>{const loaded=await catalog.all();if(JSON.stringify(loaded)!==JSON.stringify(products)){products=loaded;preserveFocus(target,render);}});
}
export async function productController() {
  const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('Selecciona un producto desde el catálogo.');let product=await catalog.find(id);const target=document.getElementById('product-detail');
  function render(){const quantity=document.getElementById('detail-quantity')?.value || '1';preserveFocus(target,()=>{productView(product);document.getElementById('detail-quantity').value=quantity;});document.title=product.nombre+' | Farmacia Reina del Cisne';}
  render();
  target.addEventListener('click',event=>{const quantity=document.getElementById('detail-quantity');const button=event.target.closest('[data-quantity]');if(button)quantity.value=Math.min(Number(quantity.max),Math.max(1,Number(quantity.value)+Number(button.dataset.quantity)));if(event.target.closest('#zoom-product')){const dialog=document.getElementById('image-dialog');const image=dialog.querySelector('img');image.src=publicImageUrl(product.imagen);image.alt=product.alt;dialog.showModal();}});
  target.addEventListener('submit',async event=>{event.preventDefault();const quantity=Number(document.getElementById('detail-quantity').value);const button=event.target.querySelector('[type=submit]');const wasFocused=document.activeElement===button;busy(button,true);try{product=await catalog.find(id);cart.add(product,quantity);message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}finally{render();if(wasFocused)document.getElementById('detail-add-button')?.focus();}});
  watchUpdates(async()=>{try{const loaded=await catalog.find(id);if(JSON.stringify(loaded)!==JSON.stringify(product)){product=loaded;render();}}catch(error){if(error.status===404){target.innerHTML='<p class="shop-empty">Este producto fue retirado del catálogo. <a href="catalogo.html">Ver productos disponibles</a></p>';}throw error;}},{canRefresh:()=>!document.querySelector('dialog[open]') && document.activeElement?.id!=='detail-quantity' && !target.querySelector('[aria-busy=true]')});
}
export async function compareController() {
  let products=await catalog.all();let chosen=selected().filter(id=>products.some(p=>p.id===id));if(!chosen.length)chosen=products.slice(0,4).map(p=>p.id);comparisonView(products,chosen);
  document.getElementById('compare-picks').addEventListener('change',event=>{if(!event.target.matches('[data-pick]'))return;const next=[...document.querySelectorAll('[data-pick]:checked')].map(field=>field.dataset.pick);if(next.length>4){event.target.checked=false;message('Puedes comparar hasta cuatro productos.',true);return;}chosen=next;sessionStorage.setItem('farmacia-mvc-comparacion',JSON.stringify(chosen));comparisonView(products,chosen);document.querySelector(`[data-pick="${event.target.dataset.pick}"]`)?.focus();});
  watchUpdates(async()=>{const loaded=await catalog.all();if(JSON.stringify(loaded)!==JSON.stringify(products)){products=loaded;chosen=chosen.filter(id=>products.some(product=>product.id===id));preserveFocus(document.getElementById('compare-picks'),()=>comparisonView(products,chosen));}});
}
