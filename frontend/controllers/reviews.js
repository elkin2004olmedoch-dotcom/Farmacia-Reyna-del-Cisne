import {customerAccount} from '../models/customer-account.js';
import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {reviewPanel,reviewList,ownReview} from '../views/reviews.js';
import {confirmAction} from './dialog.js';
export function reviewsController(productoId){
 if(document.getElementById('product-reviews'))return;
 const root=reviewPanel();document.getElementById('product-detail').after(root);const list=root.querySelector('#reviews-list'),own=root.querySelector('#review-own');let eligibility=null,page=1,saving=false,version=0;
 const customer=()=>auth.user?.role==='user';
 const sameOwner=id=>customer()&&auth.user.id===id;
 function failure(target,error,retry){target.replaceChildren();const p=document.createElement('p');p.textContent=error.message;const button=document.createElement('button');button.type='button';button.className='button button-outline';button.textContent='Reintentar';button.addEventListener('click',retry);target.append(p,button);}
 async function loadPublic(requested=1){list.setAttribute('aria-busy','true');try{const result=await customerAccount.reviews(productoId,requested);page=requested;reviewList(list,result);}catch(error){failure(list,error,()=>void loadPublic(requested));}finally{list.removeAttribute('aria-busy');}}
 async function loadOwn(){const requestId=++version,id=auth.user?.id;eligibility=null;if(!customer()){own.innerHTML=auth.user?'':'<p><a class="text-link" href="cuenta.html">Inicia sesión</a> para consultar si puedes reseñar este producto.</p>';return;}own.textContent='Consultando tu compra…';try{const result=await customerAccount.eligibility(productoId);if(requestId!==version||!sameOwner(id))return;eligibility=result;ownReview(own,result);}catch(error){if(sameOwner(id)&&requestId===version)failure(own,error,()=>void loadOwn());}}
 list.addEventListener('click',event=>{const button=event.target.closest('[data-review-page]');if(button&&!button.disabled)void loadPublic(Number(button.dataset.reviewPage));});
 own.addEventListener('submit',async event=>{event.preventDefault();if(saving||!customer()||!eligibility?.detalleId||!event.target.reportValidity())return;const id=auth.user.id,values=Object.fromEntries(new FormData(event.target));values.puntuacion=Number(values.puntuacion);if(/[<>\x00-\x1f\x7f]/.test(values.comentario)){own.querySelector('#review-status').textContent='Escribe un comentario de texto plano, sin etiquetas HTML.';return;}if(!eligibility.resena)Object.assign(values,{productoId,detalleId:eligibility.detalleId});const controls=[...event.target.querySelectorAll('input,textarea,select,button')];controls.forEach(control=>control.disabled=true);saving=true;own.querySelector('#review-status').textContent='Guardando reseña…';try{await customerAccount.saveReview(values,eligibility.resena?.id);if(!sameOwner(id))return;await Promise.all([loadPublic(1),loadOwn()]);if(sameOwner(id)&&own.querySelector('#review-status'))own.querySelector('#review-status').textContent='Reseña guardada.';}catch(error){if(sameOwner(id)&&own.querySelector('#review-status'))own.querySelector('#review-status').textContent=error.message;}finally{saving=false;controls.forEach(control=>control.disabled=false);}});
 own.addEventListener('click',async event=>{
  const button=event.target.closest('#review-remove');if(!button||saving||!customer()||!eligibility?.resena)return;
  const ownerId=auth.user.id,reviewId=eligibility.resena.id;
  if(!await confirmAction('¿Retirar tu reseña de este producto?')||!sameOwner(ownerId)||eligibility?.resena?.id!==reviewId)return;
  saving=true;button.disabled=true;
  try{await customerAccount.removeReview(reviewId);if(!sameOwner(ownerId)||eligibility?.resena?.id!==reviewId)return;await Promise.all([loadPublic(1),loadOwn()]);if(sameOwner(ownerId)&&own.querySelector('#review-status'))own.querySelector('#review-status').textContent='Reseña retirada.';}
  catch(error){if(sameOwner(ownerId)&&own.querySelector('#review-status'))own.querySelector('#review-status').textContent=error.message;}
  finally{saving=false;if(button.isConnected)button.disabled=false;}
 });
 events.addEventListener('session:changed',()=>{version++;eligibility=null;if(!customer())own.replaceChildren();else void loadOwn();});void loadPublic(page);void loadOwn();
}
