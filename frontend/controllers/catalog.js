import {catalog} from '../models/catalog.js';
import {cart} from '../models/cart.js';
import {catalogView,productView,promotionView,comparisonView} from '../views/products.js';
import {message} from '../views/common.js';
const selected=()=>{try{return JSON.parse(sessionStorage.getItem('farmacia-mvc-comparacion') || '[]').filter(id=>typeof id==='string').slice(0,4);}catch(_){return [];}};
function actions(products,target) {
  target.addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(!button)return;try{const product=products.find(p=>p.id===button.dataset.add);cart.add(product);message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}});
  target.addEventListener('change',event=>{if(!event.target.matches('[data-compare]'))return;let chosen=selected();if(event.target.checked){if(chosen.length>=4){event.target.checked=false;message('Puedes comparar hasta cuatro productos.',true);return;}chosen.push(event.target.dataset.compare);}else chosen=chosen.filter(id=>id!==event.target.dataset.compare);sessionStorage.setItem('farmacia-mvc-comparacion',JSON.stringify(chosen));});
  for(const field of target.querySelectorAll('[data-compare]'))field.checked=selected().includes(field.dataset.compare);
}
export async function homeController() {
  const products=await catalog.all();const target=document.getElementById('featured-products');catalogView(products.slice(0,4),target);actions(products,target);
  try{promotionView(await catalog.promotions());}catch(error){document.getElementById('promotions-note').textContent=error.message;}
}
export async function catalogController() {
  const products=await catalog.all();const target=document.getElementById('catalog-grid');const query=document.getElementById('catalog-search');const category=document.getElementById('catalog-category');const sort=document.getElementById('catalog-sort');
  const route=new URLSearchParams(location.search);query.value=(route.get('q') || '').slice(0,100);if(['bienestar','cuidado','bebe'].includes(route.get('category')))category.value=route.get('category');
  const normalize=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  function render(){let visible=products.filter(p=>(category.value==='todos' || p.categoria===category.value) && normalize(p.nombre+' '+p.descripcion).includes(normalize(query.value.trim())));if(sort.value!=='recommended')visible.sort((a,b)=>(Number(a.precio)-Number(b.precio))*(sort.value==='low'?1:-1));catalogView(visible,target);document.getElementById('catalog-count').textContent=`${visible.length} productos encontrados`;for(const input of target.querySelectorAll('[data-compare]'))input.checked=selected().includes(input.dataset.compare);}
  for(const input of [query,category,sort])input.addEventListener(input===query?'input':'change',render);
  document.getElementById('catalog-clear').addEventListener('click',()=>{query.value='';category.value='todos';sort.value='recommended';render();message('Filtros restablecidos.');});render();actions(products,target);
}
export async function productController() {
  const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('Selecciona un producto desde el catálogo.');const product=await catalog.find(id);productView(product);document.title=product.nombre+' | Farmacia Reina del Cisne';
  const quantity=document.getElementById('detail-quantity');
  document.querySelectorAll('[data-quantity]').forEach(button=>button.addEventListener('click',()=>{quantity.value=Math.min(Number(quantity.max),Math.max(1,Number(quantity.value)+Number(button.dataset.quantity)));}));
  document.getElementById('detail-add-form').addEventListener('submit',event=>{event.preventDefault();try{cart.add(product,Number(quantity.value));message(`${product.nombre} se añadió al carrito.`);}catch(error){message(error.message,true);}});
  document.getElementById('zoom-product').addEventListener('click',()=>{const dialog=document.getElementById('image-dialog');const image=dialog.querySelector('img');image.src=product.imagen;image.alt=product.alt;dialog.showModal();});
}
export async function compareController() {
  const products=await catalog.all();let chosen=selected().filter(id=>products.some(p=>p.id===id));if(!chosen.length)chosen=products.slice(0,4).map(p=>p.id);comparisonView(products,chosen);
  document.getElementById('compare-picks').addEventListener('change',event=>{if(!event.target.matches('[data-pick]'))return;const next=[...document.querySelectorAll('[data-pick]:checked')].map(field=>field.dataset.pick);if(next.length>4){event.target.checked=false;message('Puedes comparar hasta cuatro productos.',true);return;}chosen=next;sessionStorage.setItem('farmacia-mvc-comparacion',JSON.stringify(chosen));comparisonView(products,chosen);document.querySelector(`[data-pick="${event.target.dataset.pick}"]`)?.focus();});
}
