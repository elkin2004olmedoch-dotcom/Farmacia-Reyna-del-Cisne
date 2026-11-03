import {auth} from '../models/auth.js';
import {cart} from '../models/cart.js';
import {catalog} from '../models/catalog.js';
import {events} from '../models/events.js';
import {cartDrawerShell,cartDrawerView,accountMenuView} from '../views/cart-drawer.js';
import {message,busy} from '../views/common.js';
import {preserveFocus} from './updates.js';

let updateSession;
export function cartDrawerController(){
  if(updateSession){updateSession();return updateSession;}
  if(auth.isStaff)return;
  const dialog=document.createElement('dialog');dialog.id='cart-drawer';dialog.className='cart-drawer';dialog.setAttribute('aria-labelledby','cart-drawer-title');dialog.innerHTML=cartDrawerShell();document.body.append(dialog);
  const accountButton=document.getElementById('account-menu-toggle'),accountMenu=document.getElementById('account-menu');
  let products=[],loading=false,requestId=0,working=false,previous=null,previousSelector=null;
  const status=(text,error=false)=>{const area=dialog.querySelector('#cart-drawer-status');area.textContent=text;area.setAttribute('role',error?'alert':'status');area.classList.toggle('is-error',error);};
  function render(){
    preserveFocus(dialog,()=>cartDrawerView(dialog,cart.lines(products),{loading}));
  }
  function closeAccount(focus=false){if(!accountButton || !accountMenu)return;accountMenu.hidden=true;accountButton.setAttribute('aria-expanded','false');if(focus)accountButton.focus();}
  function captureFocus(){
    previous=document.activeElement;previousSelector=previous?.id?'#'+CSS.escape(previous.id):previous?.hasAttribute('data-add')?`[data-add="${CSS.escape(previous.dataset.add)}"]`:null;
  }
  async function refresh(){
    const request=++requestId;
    if(!Object.keys(cart.read()).length){loading=false;render();return;}
    loading=true;render();
    try{const loaded=await catalog.all();if(request===requestId && dialog.open){products=loaded;loading=false;render();}}
    catch(error){if(request===requestId && dialog.open){loading=false;render();status(error.message,true);}}
  }
  function open(added){
    if(auth.isStaff)return;
    closeAccount();
    if(added){products=products.filter(product=>product.id!==added.id);products.push(added);}
    if(!dialog.open){captureFocus();render();dialog.showModal();document.body.classList.add('cart-drawer-open');document.querySelectorAll('[data-cart-open]').forEach(button=>button.setAttribute('aria-expanded','true'));dialog.querySelector('[data-cart-close]').focus();}
    status(added?`${added.nombre} se añadió al carrito.`:'');void refresh();
  }
  function close(){if(dialog.open)dialog.close();}
  dialog.addEventListener('close',()=>{
    requestId++;loading=false;document.body.classList.remove('cart-drawer-open');document.querySelectorAll('[data-cart-open]').forEach(button=>button.setAttribute('aria-expanded','false'));
    const target=previous?.isConnected?previous:previousSelector?document.querySelector(previousSelector):null;if(!auth.isStaff)(target || document.querySelector('[data-cart-open]'))?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-cart-close]')){close();return;}
    if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)close();return;}
    const button=event.target.closest('[data-drawer-plus],[data-drawer-minus],[data-drawer-remove]');if(!button || button.disabled || working || auth.isStaff)return;
    const id=button.dataset.drawerPlus || button.dataset.drawerMinus || button.dataset.drawerRemove,focusId=button.id;
    if(button.hasAttribute('data-drawer-remove')){cart.remove(id);status('Producto retirado del carrito.');(dialog.querySelector('[data-drawer-remove]') || dialog.querySelector('[data-cart-close]')).focus();return;}
    working=true;busy(button,true);
    try{
      const product=await catalog.find(id);products=products.filter(item=>item.id!==id);products.push(product);
      const quantity=cart.read()[id];if(quantity===undefined)return;
      const next=quantity+(button.hasAttribute('data-drawer-plus')?1:-1);
      if(next<1 || next>99 || next>product.stock && next>=quantity)throw new Error('La cantidad supera las unidades disponibles.');
      if(globalThis.Farmacia.pharmacyPolicy.requiresProfessionalReview(product))throw new Error('Este producto requiere atención profesional. Retíralo y consulta con la farmacia.');
      cart.update(id,next);status('Cantidad y total actualizados.');
    }catch(error){status(error.message,true);}
    finally{
      working=false;render();const target=document.getElementById(focusId),fallback=target?.closest('.quantity-picker')?.querySelector('button:not(:disabled)');
      if(dialog.open)(target && !target.disabled?target:fallback || dialog.querySelector('[data-cart-close]'))?.focus({preventScroll:true});
    }
  });
  document.addEventListener('click',event=>{
    const opener=event.target.closest('[data-cart-open]');if(opener){event.preventDefault();open();return;}
    if(!accountButton || !accountMenu)return;
    if(event.target.closest('#account-menu-toggle')){
      if(auth.isStaff)return;
      if(!accountMenu.hidden){closeAccount(true);return;}
      accountMenu.hidden=false;accountButton.setAttribute('aria-expanded','true');accountMenu.querySelector('a')?.focus();
    }else if(!accountMenu.contains(event.target))closeAccount();
    else if(event.target.closest('a'))closeAccount();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && accountMenu && !accountMenu.hidden){event.preventDefault();closeAccount(true);}});
  document.addEventListener('focusin',event=>{if(accountMenu && !accountMenu.hidden && !accountMenu.contains(event.target) && !accountButton.contains(event.target))closeAccount();});
  accountMenu?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-customer-logout]');if(!button || button.disabled || auth.isStaff)return;busy(button,true);
    try{await auth.logout();location.assign('cuenta.html');}catch(error){closeAccount(true);message(error.message,true);}
  });
  events.addEventListener('cart:added',event=>open(event.detail.product));
  events.addEventListener('cart:changed',()=>{
    if(!dialog.open)return;
    if(Object.keys(cart.read()).some(id=>!products.some(product=>product.id===id)))void refresh();else render();
  });
  events.addEventListener('data:changed',()=>{if(dialog.open)void refresh();});
  updateSession=()=>{
    closeAccount();if(auth.isStaff)close();
    if(accountButton && accountMenu){accountButton.hidden=auth.isStaff;if(!auth.isStaff)accountMenuView(accountButton,accountMenu,auth.user);}
    for(const button of document.querySelectorAll('[data-cart-open]')){button.setAttribute('aria-controls','cart-drawer');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded',String(dialog.open));}
  };
  events.addEventListener('session:changed',updateSession);updateSession();return updateSession;
}
