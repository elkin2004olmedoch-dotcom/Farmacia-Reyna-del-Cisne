import '../models/ecuador.js';
import {auth,sessionSignalKey} from '../models/auth.js';
import {catalog} from '../models/catalog.js';
import {cart} from '../models/cart.js';
import {cartPricing} from '../models/pricing.js';
import {orders} from '../models/orders.js';
import {payments} from '../models/payments.js';
import {paymentCardController} from './payment-card.js';
import {cartView,confirmationView,ordersView} from '../views/orders.js';
import {message,formErrors,busy} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {requireUser} from './layout.js';
import {events} from '../models/events.js';
import {watchUpdates,preserveFocus} from './updates.js';
import {deliveryCheckout} from './delivery-checkout.js';
import {connectOrderReceipts} from './receipts.js';
import {connectOrderMaps} from './order-map.js';
import {connectSavedAddresses,connectReorder} from './customer-account.js';
import '../models/pharmacy-policy.js';
const {allowsPurchase}=globalThis.Farmacia.pharmacyPolicy;
export async function checkoutController() {
  connectReorder(document.getElementById('order-confirmation'));
  const updateReceipts=connectOrderReceipts(document.getElementById('order-confirmation'));
  const updateMaps=connectOrderMaps(document.getElementById('order-confirmation'));
  let products=await catalog.all();const form=document.getElementById('delivery-form');const next=document.getElementById('checkout-next');
  const target=document.getElementById('checkout-items');
  const content=document.getElementById('checkout-content'),cartPanel=document.getElementById('purchase-cart-panel'),summary=document.getElementById('purchase-summary');
  function showDetails(show){
    form.hidden=!show;
    if(cartPanel)cartPanel.hidden=show;
    if(summary){
      (show?document.getElementById('purchase-summary-slot'):content).append(summary);
      document.getElementById('checkout-review-items').hidden=!show;
      document.getElementById('purchase-login-note').hidden=show;
    }
    next.hidden=show;
    for(const step of document.querySelectorAll('[data-purchase-step]')){
      const current=step.dataset.purchaseStep===(show?'details':'cart');
      step.toggleAttribute('aria-current',current);if(current)step.setAttribute('aria-current','step');
      step.classList.toggle('complete',show && step.dataset.purchaseStep==='cart');
    }
  }
  const config=await (auth.user?payments.checkoutConfiguration():payments.configuration());
  const practice=config.practica?.disponible===true;let cardWidget=null;
  const payRoot=document.getElementById('checkout-payment-fields'),payNote=document.getElementById('checkout-payment-note');
  if(practice){cardWidget=paymentCardController(payRoot);form.querySelector('[name=paymentPreference][value=manual]').closest('label').hidden=true;form.elements.paymentPreference.value='card';}
  function paymentView(){const method=form.elements.paymentPreference.value;payRoot.hidden=!practice||method!=='card';if(payRoot.hidden)cardWidget?.clear();const bank=document.getElementById('checkout-transfer-details');bank.hidden=method!=='transfer';bank.replaceChildren();if(method==='transfer'){const value=config.transferencia;if(value?.disponible){for(const text of [value.banco,`Cuenta de ${value.tipo} · ${value.numeroCuenta}`,value.titular]){const p=document.createElement('p');p.textContent=text;bank.append(p);}}else bank.textContent='Consulta los datos de transferencia con la farmacia.';}payNote.textContent=practice?'Sin cobro real. Completa el pago antes de confirmar tu compra; no realices una transferencia bancaria.':'Coordina el pago con la farmacia antes de retirar tu compra.';form.querySelector('[type=submit]').textContent=practice?'Pagar y confirmar compra':'Confirmar pedido';}
  for(const input of form.querySelectorAll('[name=paymentPreference]'))input.addEventListener('change',paymentView);paymentView();
  let shipping;
  function validCart(){const lines=cart.lines(products);return lines.length>0 && lines.every(line=>line.producto && allowsPurchase(line.producto) && line.cantidad<=line.producto.stock);}
  function render(){
    const lines=cart.lines(products),totals=cartPricing(lines);
    if(!lines.length&&!form.hidden)showDetails(false);
    preserveFocus(target,()=>cartView(lines,totals.total));shipping?.render(totals.complete?totals.total:null);next.disabled=!validCart();
    if(!totals.complete){
      document.getElementById('checkout-grand-total').textContent='Por confirmar';
      document.getElementById('checkout-shipping-fee').textContent='Por confirmar';
      document.getElementById('checkout-shipping-status').textContent='Revisa los productos y consulta los importes pendientes con la farmacia antes de continuar.';
    }
    if(summary)summary.hidden=!lines.length;
    document.getElementById('purchase-login-note').textContent=auth.user?'Al continuar podrás revisar la entrega y el pago.':'Inicia sesión para confirmar tu pedido.';
    const submit=form.querySelector('[type=submit]');submit.disabled=!validCart() || shipping?.enabled()===false || submit.getAttribute('aria-busy')==='true';document.getElementById('checkout-clear').hidden=!lines.length;
  }
  render();globalThis.Farmacia.validation.provinces.forEach(province=>{const option=document.createElement('option');option.value=option.textContent=province;document.getElementById('checkout-province').append(option);});
  for(const [key,value] of Object.entries({name:auth.user?.nombre || '',email:auth.user?.email || '',phone:auth.user?.telefono || ''}))form.elements.namedItem(key).value=value;
  shipping=deliveryCheckout(form,render);render();void shipping.ready;
  void connectSavedAddresses(form,shipping);
  const address=document.getElementById('delivery-address');
  for(const field of form.querySelectorAll('[name=delivery]'))field.addEventListener('change',()=>{address.hidden=form.elements.delivery.value!=='delivery';const pickup=document.getElementById('purchase-pickup-info');if(pickup)pickup.hidden=!address.hidden;if(form.elements.delivery.value==='pickup')shipping.reset();render();});
  next.addEventListener('click',()=>{if(!requireUser())return;showDetails(true);form.querySelector('input[name=name]').focus();});
  document.getElementById('purchase-edit-cart')?.addEventListener('click',()=>{showDetails(false);target.querySelector('input')?.focus();});
  function focusCartAction(){(next.disabled?target.querySelector('input:not(:disabled),.shop-empty a'):next)?.focus();}
  document.getElementById('checkout-clear').addEventListener('click',async()=>{if(await confirmAction('¿Vaciar todo el carrito?')){cart.clear();showDetails(false);render();focusCartAction();message('Carrito vaciado.');}});
  async function change(id,quantity){const product=products.find(p=>p.id===id);if(!product || (quantity>product.stock && quantity>=cart.read()[id]))throw new Error('La cantidad supera las unidades disponibles.');cart.update(id,quantity);render();message('Cantidad y total actualizados.');}
  target.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;try{if(button.dataset.cartRemove){if(await confirmAction('¿Quitar este producto del carrito?')){cart.remove(button.dataset.cartRemove);render();focusCartAction();message('Producto eliminado del carrito.');}}else{const id=button.dataset.cartPlus || button.dataset.cartMinus;await change(id,cart.read()[id]+(button.dataset.cartPlus?1:-1));document.getElementById('qty-'+id)?.focus();}}catch(error){message(error.message,true);}});
  target.addEventListener('change',async event=>{if(event.target.dataset.cartQuantity){const id=event.target.dataset.cartQuantity;try{await change(id,Number(event.target.value));}catch(error){render();message(error.message,true);}document.getElementById('qty-'+id)?.focus();}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.querySelector('[type=submit]').getAttribute('aria-busy')==='true'||!requireUser())return;const cartSignature=JSON.stringify(cart.payload());const values=Object.fromEntries(new FormData(form));const accepted=values.terms;const method=['card','transfer','manual'].includes(values.paymentPreference)?values.paymentPreference:'manual';delete values.paymentPreference;delete values.terms;delete values.zonaEntregaId;Object.assign(values,shipping.values());
    const issues={...globalThis.Farmacia.validation.validateCheckout(values),...shipping.issues()};if(!accepted)issues.terms='Acepta las condiciones del pedido.';
    if(!formErrors(form,issues)){message('Revisa los campos del pedido.',true);return;}
    if(!cart.payload().length){message('Tu carrito está vacío.',true);return;}
    if(!validCart()){message('Revisa el carrito: hay productos retirados, con receta obligatoria o cantidades superiores al stock disponible.',true);render();return;}
    const button=form.querySelector('[type=submit]');busy(button,true);
    try{if(values.delivery==='delivery'){message('Localizando el destino de tu pedido…');const result=await shipping.verify(values);if(result.delivery==='pickup'){shipping.pickup();message(result.message,false,true);return;}}let payment;if(practice){if(!['card','transfer'].includes(method))throw new Error('Selecciona tarjeta o transferencia.');if(method==='card'&&!cardWidget.brand){cardWidget.open();return;}const total=cart.total(products)+shipping.fee();if(!await confirmAction(`Revisa tu compra: ${new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(total/100)}. ${method==='card'?'Tarjeta':'Transferencia'} · Sin cobro real. ¿Pagar y confirmar?`))return;payment={pago:{metodo:method,...(method==='card'?{marca:cardWidget.brand}:{})},esperadoTotalCentavos:total};}
      if(JSON.stringify(cart.payload())!==cartSignature)throw new Error('Tu carrito cambió mientras revisabas la compra. Revisa el total y confirma de nuevo.');
      const order=await orders.create(cart.payload(),values,payment);cardWidget?.clear();const images=new Map(products.map(product=>[product.id,product.imagen]));const confirmed={...order,metodoPreferido:method,detalles:order.detalles.map(line=>({...line,imagen:images.get(line.productoId)}))};cart.clear();form.reset();shipping.reset();confirmationView(confirmed);updateReceipts([confirmed]);updateMaps([confirmed]);message('Pedido registrado en la farmacia.');}
    catch(error){if(error.code==='DELIVERY_PICKUP_REQUIRED'){shipping.pickup();message(error.message,false,true);return;}message(error.message,true,true);if(error.status===401)requireUser();if(error.status===409){cardWidget?.clear();try{products=await catalog.all();await shipping.reload();render();}catch(refreshError){message(`${error.message} ${refreshError.message}`,true,true);}}}finally{busy(button,false);if(!document.getElementById('checkout-content').hidden)render();}
  });
  events.addEventListener('cart:changed',()=>{if(!document.getElementById('checkout-content').hidden)render();});
  const refresh=watchUpdates(async()=>{const loaded=await catalog.all();if(JSON.stringify(loaded)!==JSON.stringify(products)){products=loaded;render();}},{canRefresh:()=>!document.getElementById('checkout-content').hidden && !document.querySelector('dialog[open]') && form.querySelector('[type=submit]').getAttribute('aria-busy')!=='true' && !document.activeElement?.matches('[data-cart-quantity]')});
  target.addEventListener('focusout',()=>{void refresh();});
}
export async function ordersController() {
  const area=document.getElementById('orders-list');connectReorder(area);
  if(!requireUser('pedidos.html'))return;
  let page=1,requestId=0,snapshot='',navigating=false,cancelling=false,sessionVersion=0,sessionDirty=false;
  const available=new Map(),updateReceipts=connectOrderReceipts(area),updateMaps=connectOrderMaps(area);
  function invalidate(){sessionVersion++;requestId++;sessionDirty=true;snapshot='';available.clear();updateReceipts([]);updateMaps([]);area.replaceChildren();}
  events.addEventListener('session:changed',invalidate);events.addEventListener('session:expired',invalidate);
  window.addEventListener('storage',event=>{if(event.key===sessionSignalKey)invalidate();});
  async function restoreSession(){
    const previous=auth.user;await auth.restore();
    const changed=previous?.id!==auth.user?.id || previous?.role!==auth.user?.role;
    if(changed)events.dispatchEvent(new Event('session:changed'));
    return changed;
  }
  async function render(requestedPage=page){
    const id=++requestId,version=sessionVersion;
    if(sessionDirty){if(await restoreSession())return render(1);if(id!==requestId || version!==sessionVersion)return;sessionDirty=false;}
    const owner=auth.user?.id;if(!owner)return;
    const result=await orders.mine(requestedPage);
    if(id!==requestId || version!==sessionVersion || auth.user?.id!==owner)return;
    const loaded=JSON.stringify(result);
    if(loaded!==snapshot){available.clear();for(const order of result.items)available.set(order.id,order);updateReceipts(result.items);updateMaps(result.items);preserveFocus(area,()=>ordersView(result));snapshot=loaded;}
    page=requestedPage;document.getElementById('orders-page-info').textContent=`Página ${requestedPage} · ${result.total} pedidos`;document.getElementById('orders-prev').disabled=requestedPage<=1;document.getElementById('orders-next').disabled=requestedPage*result.pageSize>=result.total;
  }
  area.addEventListener('click',async event=>{
    const button=event.target.closest('[data-order-cancel]');if(!button || button.disabled || cancelling || navigating)return;
    const order=available.get(button.dataset.orderCancel),owner=auth.user?.id,version=sessionVersion;
    if(!order || !owner || order.userId!==owner || !['pendiente','confirmado'].includes(order.estado))return;
    const sameSession=()=>sessionVersion===version && auth.user?.id===owner;
    const focusOrder=()=>{(document.getElementById('order-title-'+order.id) || document.getElementById('page-status')).focus({preventScroll:true});};
    cancelling=true;requestId++;
    try{
      if(!await confirmAction('¿Cancelar este pedido antes de su preparación? Sus productos se devolverán al inventario. Si existe un cobro real o una factura emitida, la farmacia debe revisar la cancelación.'))return;
      if(!sameSession())throw new Error('Tu sesión cambió. Revisa tus pedidos antes de volver a confirmar.');
      await restoreSession();
      if(!sameSession())throw new Error('Tu sesión cambió. Revisa tus pedidos antes de volver a confirmar.');
      busy(button,true);await orders.cancel(order.id,order.updatedAt);
      if(!sameSession())return;
      await render();if(!sameSession())return;
      message('Pedido cancelado. Sus productos se devolvieron al inventario.');focusOrder();
    }catch(error){
      if(error.status===409 && sameSession()){
        try{await render();}catch(refreshError){message(`${error.message} ${refreshError.message}`,true,true);return;}
      }
      message(error.message,true);focusOrder();if(error.status===401)requireUser('pedidos.html');
    }finally{cancelling=false;if(button.isConnected)busy(button,false);}
  });
  for(const [id,offset] of [['orders-prev',-1],['orders-next',1]])document.getElementById(id).addEventListener('click',async()=>{
    if(navigating || cancelling)return;navigating=true;
    try{await render(page+offset);}catch(error){message(error.message,true);}finally{navigating=false;}
  });
  const refresh=watchUpdates(render,{canRefresh:()=>Boolean(auth.user) && !navigating && !cancelling,intervalMs:5000});
  await refresh();if(auth.user && !snapshot)document.getElementById('orders-list').textContent='No se pudieron cargar los pedidos. Volveremos a intentar.';
}
