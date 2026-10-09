import '../models/ecuador.js';
import {auth} from '../models/auth.js';
import {catalog} from '../models/catalog.js';
import {cart} from '../models/cart.js';
import {orders} from '../models/orders.js';
import {cartView,confirmationView,ordersView} from '../views/orders.js';
import {message,formErrors,busy} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {requireUser} from './layout.js';
export async function checkoutController() {
  let products=await catalog.all();const form=document.getElementById('delivery-form');const next=document.getElementById('checkout-next');
  function render(){const lines=cart.lines(products);cartView(lines,cart.total(products));next.disabled=!lines.length;document.getElementById('checkout-clear').hidden=!lines.length;}
  render();globalThis.Farmacia.validation.provinces.forEach(province=>{const option=document.createElement('option');option.value=option.textContent=province;document.getElementById('checkout-province').append(option);});
  for(const [key,value] of Object.entries({name:auth.user?.nombre || '',email:auth.user?.email || '',phone:auth.user?.telefono || ''}))form.elements.namedItem(key).value=value;
  const address=document.getElementById('delivery-address');
  for(const field of form.querySelectorAll('[name=delivery]'))field.addEventListener('change',()=>{address.hidden=form.elements.delivery.value!=='delivery';});
  next.addEventListener('click',()=>{if(!requireUser())return;form.hidden=false;form.querySelector('input[name=name]').focus();});
  document.getElementById('checkout-clear').addEventListener('click',async()=>{if(await confirmAction('¿Vaciar todo el carrito?')){cart.clear();form.hidden=true;render();message('Carrito vaciado.');}});
  const target=document.getElementById('checkout-items');
  async function change(id,quantity){const product=products.find(p=>p.id===id);if(!product || quantity>product.stock)throw new Error('La cantidad supera las unidades disponibles.');cart.update(id,quantity);render();message('Cantidad y total actualizados.');}
  target.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;try{if(button.dataset.cartRemove){if(await confirmAction('¿Quitar este producto del carrito?')){cart.remove(button.dataset.cartRemove);render();next.focus();message('Producto eliminado del carrito.');}}else{const id=button.dataset.cartPlus || button.dataset.cartMinus;await change(id,cart.read()[id]+(button.dataset.cartPlus?1:-1));document.getElementById('qty-'+id)?.focus();}}catch(error){message(error.message,true);}});
  target.addEventListener('change',async event=>{if(event.target.dataset.cartQuantity){const id=event.target.dataset.cartQuantity;try{await change(id,Number(event.target.value));}catch(error){render();message(error.message,true);}document.getElementById('qty-'+id)?.focus();}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!requireUser())return;const values=Object.fromEntries(new FormData(form));const accepted=values.terms;delete values.terms;
    const issues=globalThis.Farmacia.validation.validateCheckout(values);if(!accepted)issues.terms='Acepta las condiciones del pedido.';
    if(!formErrors(form,issues)){message('Revisa los campos del pedido.',true);return;}
    if(!cart.payload().length){message('Tu carrito está vacío.',true);return;}
    const button=form.querySelector('[type=submit]');busy(button,true);
    try{const order=await orders.create(cart.payload(),values);cart.clear();form.reset();confirmationView(order);message('Pedido registrado en la farmacia.');}
    catch(error){message(error.message,true,true);if(error.status===401)requireUser();if(error.status===409){products=await catalog.all();render();}}finally{busy(button,false);}
  });
}
export async function ordersController() {
  if(!requireUser('pedidos.html'))return;let page=1;
  async function render(){const result=await orders.mine(page);ordersView(result);document.getElementById('orders-page-info').textContent=`Página ${page} · ${result.total} pedidos`;document.getElementById('orders-prev').disabled=page<=1;document.getElementById('orders-next').disabled=page*result.pageSize>=result.total;}
  for(const [id,offset] of [['orders-prev',-1],['orders-next',1]])document.getElementById(id).addEventListener('click',async()=>{page+=offset;try{await render();}catch(error){message(error.message,true);}});await render();
}
