import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {customerAccount,mergeReorder} from '../models/customer-account.js';
import {cart} from '../models/cart.js';
import {accountPanels,addressList,favoritesList,reorderView} from '../views/customer-account.js';
import {busy,message} from '../views/common.js';
import {confirmAction} from './dialog.js';
let favoriteIds=new Set(),favoriteUser=null,favoriteLoad=null;
const customer=()=>auth.user?.role==='user';
const owner=()=>customer()?auth.user.id:null;
const sameOwner=id=>Boolean(id)&&owner()===id;
function syncFavorites(target=document){for(const button of target.querySelectorAll('[data-favorite]')){const saved=favoriteUser===owner()&&favoriteIds.has(button.dataset.favorite),text=saved?'♥ Guardado':'♡ Favorito';button.setAttribute('aria-pressed',String(saved));if(button.textContent!==text)button.textContent=text;}}
async function loadFavorites(){
 const ownerId=owner();if(!ownerId){favoriteIds.clear();favoriteUser=null;return [];}if(favoriteLoad?.ownerId===ownerId)return favoriteLoad.promise;
 const loading={ownerId,promise:null};loading.promise=customerAccount.favorites().then(items=>{if(!sameOwner(ownerId))return [];favoriteIds=new Set(items.map(item=>item.productoId));favoriteUser=ownerId;syncFavorites();return items;}).finally(()=>{if(favoriteLoad===loading)favoriteLoad=null;});favoriteLoad=loading;return loading.promise;
}
events.addEventListener('session:changed',()=>{const ownerId=owner();if(favoriteUser!==ownerId){favoriteIds.clear();favoriteUser=null;syncFavorites();}for(const id of ['customer-account-panels','saved-address-picker','reorder-dialog']){const root=document.getElementById(id);if(root&&root.dataset.customerOwner!==ownerId){if(id==='reorder-dialog')root.close();else root.remove();}}});
export function connectFavorites(target){
 if(!target||target.dataset.favoritesConnected)return;target.dataset.favoritesConnected='true';
 const observer=new MutationObserver(()=>syncFavorites(target));observer.observe(target,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 target.addEventListener('click',async event=>{
  const button=event.target.closest('[data-favorite]');if(!button||button.disabled)return;
  if(!customer()){message(auth.user?'Los favoritos están disponibles para cuentas de cliente.':'Inicia sesión para guardar favoritos.',true);if(!auth.user)location.assign('cuenta.html');return;}
  const ownerId=owner();busy(button,true);try{if(favoriteUser!==ownerId)await loadFavorites();if(!sameOwner(ownerId))return;const saved=!favoriteIds.has(button.dataset.favorite);await customerAccount.favorite(button.dataset.favorite,saved);if(!sameOwner(ownerId))return;if(saved)favoriteIds.add(button.dataset.favorite);else favoriteIds.delete(button.dataset.favorite);syncFavorites();events.dispatchEvent(new Event('favorites:changed'));message(saved?'Producto guardado en favoritos.':'Producto retirado de favoritos.');}catch(error){if(sameOwner(ownerId))message(error.message,true);}finally{if(button.isConnected){busy(button,false);if(sameOwner(ownerId))button.focus();}}
 });
 const ownerId=owner();if(ownerId)void loadFavorites().catch(error=>{if(sameOwner(ownerId))message(error.message,true);});syncFavorites(target);
}
function retry(target,error,load){target.replaceChildren();const p=document.createElement('p');p.textContent=error.message;const button=document.createElement('button');button.type='button';button.className='button button-outline';button.textContent='Reintentar';button.addEventListener('click',()=>void load());target.append(p,button);}
export function customerAccountController(){
 if(!customer())return;const ownerId=owner();accountPanels(document.getElementById('account-area'));const root=document.getElementById('customer-account-panels');root.dataset.customerOwner=ownerId;const current=()=>sameOwner(ownerId)&&root.isConnected;
 const target=document.getElementById('saved-addresses'),favorites=document.getElementById('saved-favorites'),form=document.getElementById('saved-address-form'),status=document.getElementById('saved-address-status'),cancel=document.getElementById('saved-address-cancel');let addresses=[],editing=null,saving=false;
 const reset=()=>{editing=null;form.reset();cancel.hidden=true;document.getElementById('saved-address-form-title').textContent='Guardar una dirección';};
 const load=async()=>{if(!current())return;target.textContent='Cargando direcciones…';try{const loaded=await customerAccount.addresses();if(!current())return;addresses=loaded;addressList(target,addresses);}catch(error){if(current())retry(target,error,load);}};
 const loadSaved=async()=>{if(!current())return;favorites.textContent='Cargando favoritos…';try{const items=await loadFavorites();if(current()){favoritesList(favorites,items);syncFavorites(favorites);}}catch(error){if(current())retry(favorites,error,loadSaved);}};
 connectFavorites(favorites);events.addEventListener('favorites:changed',loadSaved);void load();void loadSaved();
 cancel.addEventListener('click',()=>{if(saving||!current())return;reset();status.textContent='Edición cancelada.';form.elements.alias.focus();});
 target.addEventListener('click',async event=>{const edit=event.target.closest('[data-address-edit]'),remove=event.target.closest('[data-address-delete]');if(saving||!current())return;if(edit){editing=addresses.find(item=>item.id===edit.dataset.addressEdit);if(!editing)return;for(const field of ['alias','provincia','ciudad','direccion','codigoPostal'])form.elements[field].value=editing[field]||'';cancel.hidden=false;document.getElementById('saved-address-form-title').textContent='Editar dirección';status.textContent='';form.elements.alias.focus();}if(remove){const id=remove.dataset.addressDelete;if(!await confirmAction('¿Eliminar esta dirección guardada?')||!current())return;busy(remove,true);try{await customerAccount.removeAddress(id);if(!current())return;if(editing?.id===id)reset();await load();if(current())status.textContent='Dirección eliminada.';}catch(error){if(current())status.textContent=error.message;}finally{if(remove.isConnected)busy(remove,false);}}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(saving||!current()||!form.reportValidity())return;saving=true;const values=Object.fromEntries(new FormData(form));if(editing)values.esperadoUpdatedAt=editing.updatedAt;const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(control=>control.disabled=true);status.textContent='Guardando dirección…';try{await customerAccount.saveAddress(values,editing?.id);if(!current())return;reset();await load();if(current())status.textContent='Dirección guardada.';}catch(error){if(current()){status.textContent=error.message;if(error.status===409)await load();}}finally{saving=false;controls.forEach(control=>control.disabled=false);}});
}
export async function connectSavedAddresses(form,shipping){
 if(!customer())return;const ownerId=owner(),root=document.createElement('div');root.id='saved-address-picker';root.dataset.customerOwner=ownerId;root.className='shop-field';const current=()=>sameOwner(ownerId)&&root.isConnected;const label=document.createElement('label');label.htmlFor='checkout-saved-address';label.textContent='Usar una dirección guardada';const select=document.createElement('select');select.id='checkout-saved-address';const status=document.createElement('p');status.setAttribute('role','status');root.append(label,select,status);form.prepend(root);let items=[];
 const load=async()=>{if(!current())return;select.disabled=true;select.replaceChildren(new Option('Cargando direcciones…',''));try{const loaded=await customerAccount.addresses();if(!current())return;items=loaded;select.replaceChildren(new Option(items.length?'Escribir o seleccionar dirección':'Sin direcciones guardadas',''),...items.map(item=>new Option(`${item.alias} · ${item.ciudad}`,item.id)));status.textContent='También puedes gestionar tus direcciones en Mi cuenta.';}catch(error){if(!current())return;status.textContent=error.message;const button=document.createElement('button');button.type='button';button.textContent='Reintentar direcciones';button.className='button button-outline';button.addEventListener('click',()=>{button.remove();void load();});root.append(button);}finally{select.disabled=false;}};
 select.addEventListener('change',async()=>{if(!current())return;const item=items.find(row=>row.id===select.value);if(!item)return;await shipping.ready;if(!current())return;shipping.reset();for(const [field,key] of Object.entries({province:'provincia',city:'ciudad',address:'direccion',postalCode:'codigoPostal'}))form.elements[field].value=item[key]||'';const delivery=form.querySelector('[name=delivery][value=delivery]');delivery.checked=true;delivery.dispatchEvent(new Event('change',{bubbles:true}));for(const field of ['province','city'])form.elements[field].dispatchEvent(new Event('change',{bubbles:true}));status.textContent='Dirección aplicada. Revisa cobertura, ubicación y total antes de confirmar.';});await load();
}
export function connectReorder(target){
 target.addEventListener('click',async event=>{
  const button=event.target.closest('[data-reorder]');if(!button||button.disabled||!customer())return;const ownerId=owner();busy(button,true);let dialog;
  try{
   let proposal=await customerAccount.reorder(button.dataset.reorder);if(!sameOwner(ownerId))return;let existing=cart.read(),snapshot=JSON.stringify(existing),saving=false;
   dialog=document.createElement('dialog');dialog.id='reorder-dialog';dialog.dataset.customerOwner=ownerId;dialog.className='reorder-dialog';dialog.setAttribute('aria-labelledby','reorder-title');document.body.append(dialog);reorderView(dialog,proposal,existing);dialog.addEventListener('close',()=>{dialog.remove();if(button.isConnected&&sameOwner(ownerId))button.focus();},{once:true});
   dialog.addEventListener('click',e=>{if(e.target.closest('[data-reorder-cancel]')&&!saving)dialog.close();});dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
   dialog.addEventListener('submit',async e=>{e.preventDefault();if(saving||!sameOwner(ownerId)||!dialog.isConnected)return;const values=Object.fromEntries([...new FormData(e.target)].map(([id,value])=>[id,Number(value)]));saving=true;const submit=dialog.querySelector('[type=submit]');busy(submit,true);
    try{const fresh=await customerAccount.reorder(button.dataset.reorder);if(!sameOwner(ownerId)||!dialog.isConnected)return;const current=cart.read();if(JSON.stringify(fresh)!==JSON.stringify(proposal)||JSON.stringify(current)!==snapshot){proposal=fresh;existing=current;snapshot=JSON.stringify(current);reorderView(dialog,proposal,existing,'La disponibilidad, el precio o tu carrito cambió. Revisa la nueva propuesta y confirma de nuevo.');dialog.querySelector('[type=submit]').focus();return;}cart.write(mergeReorder(current,fresh,values));dialog.close();message('Unidades confirmadas añadidas al carrito. Revisa el checkout antes de comprar.');}
    catch(error){if(sameOwner(ownerId)&&dialog.isConnected)dialog.querySelector('#reorder-status').textContent=error.message;}
    finally{saving=false;if(submit.isConnected)busy(submit,false);}
   });dialog.showModal();dialog.querySelector('[data-reorder-cancel]').focus();
  }catch(error){if(sameOwner(ownerId))message(error.message,true);dialog?.remove();}finally{if(button.isConnected)busy(button,false);}
 });
}
