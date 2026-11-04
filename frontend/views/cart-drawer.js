import {privateEmail,escape,money,priceMarkup,productMetadata} from './common.js';
import {productImageUrl} from '../config.js';
import {cartPricing} from '../models/pricing.js';
import '../models/pharmacy-policy.js';
const {requiresProfessionalReview}=globalThis.Farmacia.pharmacyPolicy;

export function cartDrawerShell(){
  return `<div class="cart-drawer-header"><h2 id="cart-drawer-title">Tu carrito <span id="cart-drawer-count"></span></h2><button type="button" class="cart-drawer-close" data-cart-close aria-label="Cerrar carrito" autofocus>×</button></div><p id="cart-drawer-status" class="cart-drawer-status" role="status" aria-live="polite"></p><div id="cart-drawer-items"></div><footer class="cart-drawer-footer"><div class="cart-drawer-summary"></div><p class="cart-drawer-note">Revisa tus productos y elige retiro o entrega. La tarifa se confirma antes de finalizar.</p><div class="cart-drawer-actions"><a class="button button-primary" href="checkout.html">Ir al carrito →</a><button class="button button-outline" type="button" data-cart-close>Seguir comprando</button></div></footer>`;
}
export function cartDrawerView(dialog,lines,{loading=false}={}){
  const units=lines.reduce((sum,line)=>sum+line.cantidad,0);
  dialog.querySelector('#cart-drawer-count').textContent=`(${units})`;
  dialog.querySelector('#cart-drawer-items').innerHTML=lines.length?lines.map(line=>{
    const product=line.producto,id=escape(line.productoId),name=product?.nombre || (loading?'Consultando producto…':'Producto retirado'),maximum=Math.min(99,product?.stock || 0),review=product && requiresProfessionalReview(product);
    const image=product?`<a href="producto.html?id=${encodeURIComponent(line.productoId)}" tabindex="-1" aria-hidden="true"><img data-product-image class="cart-drawer-thumb" src="${escape(productImageUrl(product.imagen))}" alt="${escape(product.alt || name)}" width="80" height="90"></a>`:'<span class="cart-drawer-thumb cart-drawer-placeholder" aria-hidden="true">—</span>';
    const availability=!product?(loading?'Consultando disponibilidad…':'Retira este artículo para continuar.'):review?'Requiere atención profesional. Retíralo y consulta con la farmacia.':line.cantidad>product.stock?`Sólo ${product.stock} disponibles. Reduce la cantidad para continuar.`:`${product.stock} disponibles`;
    return `<article class="cart-drawer-item" data-drawer-item="${id}">${image}<div class="cart-drawer-copy"><h3>${product?`<a href="producto.html?id=${encodeURIComponent(line.productoId)}">${escape(name)}</a>`:escape(name)}</h3>${productMetadata(product)}${product?`<div class="cart-drawer-price">${priceMarkup(product)} <span class="cart-unit-label">por unidad</span></div>`:''}<p class="product-stock${review || product && line.cantidad>product.stock?' is-error':''}">${escape(availability)}</p><div class="cart-drawer-item-actions"><div class="quantity-picker"><button id="drawer-minus-${id}" type="button" data-drawer-minus="${id}" ${!product || line.cantidad<=1?'disabled':''} aria-label="Reducir cantidad de ${escape(name)}">−</button><span class="cart-drawer-quantity" aria-label="Cantidad de ${escape(name)}">${line.cantidad}</span><button id="drawer-plus-${id}" type="button" data-drawer-plus="${id}" ${!product || review || line.cantidad>=maximum?'disabled':''} aria-label="Aumentar cantidad de ${escape(name)}">+</button></div><button id="drawer-remove-${id}" type="button" class="text-link" data-drawer-remove="${id}" aria-label="Quitar ${escape(name)} del carrito">Quitar</button></div></div>${product?`<strong class="cart-drawer-line-total" aria-label="Total de ${escape(name)}"><span class="cart-line-label">Subtotal</span>${money(Math.round(Number(product.precio)*100)*line.cantidad)}</strong>`:''}</article>`;
  }).join(''):'<div class="cart-drawer-empty"><p>Tu carrito está vacío.</p><a href="catalogo.html" class="text-link">Explorar productos →</a><button type="button" class="button button-outline" data-cart-close>Seguir comprando</button></div>';
  const totals=cartPricing(lines);
  dialog.querySelector('.cart-drawer-footer').hidden=!lines.length;
  dialog.querySelector('.cart-drawer-summary').innerHTML=`<dl><div><dt>Subtotal sin IVA</dt><dd>${totals.complete?money(totals.base):'Por confirmar'}</dd></div><div><dt>IVA incluido</dt><dd>${totals.complete?money(totals.iva):'Por confirmar'}</dd></div><div class="cart-drawer-total"><dt>Total de productos</dt><dd>${totals.complete?money(totals.total):'Por confirmar'}</dd></div></dl>`;
}
const accountIcon='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 22v-3a8 8 0 0 1 16 0v3"></path></svg>';
const initials=user=>user.nombre.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase('es');
export function accountMenuView(button,menu,user){
  button.innerHTML=user?`<span class="account-avatar" aria-hidden="true">${escape(initials(user))}</span><span class="account-toggle-label">${escape(user.nombre.split(' ')[0])}</span>`:`${accountIcon}<span class="account-toggle-label">Mi cuenta</span>`;
  button.setAttribute('aria-label',user?`Abrir menú de ${user.nombre}`:'Abrir menú de cuenta');
  menu.innerHTML=`${user?`<div class="account-menu-identity"><span class="account-avatar" aria-hidden="true">${escape(initials(user))}</span><div><strong>${escape(user.nombre)}</strong><small>${escape(privateEmail(user.email))}</small></div></div>`:''}<nav class="account-menu-links" aria-label="Tu cuenta"><a href="cuenta.html">${user?'Mi cuenta':'Iniciar sesión'}</a><a href="pedidos.html">Mis pedidos</a>${user?'<button type="button" class="text-link" data-customer-logout>Cerrar sesión</button>':''}</nav>`;
}
