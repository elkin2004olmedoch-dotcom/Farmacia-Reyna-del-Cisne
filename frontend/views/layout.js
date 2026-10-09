import {escape} from './common.js';
export function sessionView(user,count) {
  const admin=user?.role==='admin';document.body.dataset.sessionRole=admin?'admin':user?'user':'guest';
  for(const link of document.querySelectorAll('[data-account-link]')){link.textContent=admin?'Panel':user?`Hola, ${user.nombre.split(' ')[0]}`:'Ingresar';link.href=admin?'admin.html':'cuenta.html';}
  for(const link of document.querySelectorAll('[data-admin-link]'))link.hidden=user?.role!=='admin';
  for(const element of document.querySelectorAll('[data-admin-session]'))element.hidden=!admin;
  for(const element of document.querySelectorAll('[data-admin-guest]'))element.hidden=admin;
  for(const element of document.querySelectorAll('[data-admin-name]'))element.textContent=user?.nombre || '';
  for(const counter of document.querySelectorAll('[data-shop-count]'))counter.textContent=count;
  for(const link of document.querySelectorAll('.shop-cart'))link.setAttribute('aria-label',`Carrito, ${count} unidades`);
}
export function accountView(user) {
  const panel=document.getElementById('account-area');
  const links=user.role==='admin'?'<a href="admin.html" class="button button-primary">Administrar farmacia →</a><a href="index.html" class="button button-outline">Ver tienda →</a>':'<a href="pedidos.html" class="button button-primary">Ver mis pedidos →</a><a href="checkout.html" class="button button-outline">Continuar mi compra →</a>';
  panel.innerHTML=`<p class="eyebrow">${user.role==='admin'?'Gestión de la farmacia':'Tu farmacia en línea'}</p><h1>Hola, ${escape(user.nombre)}.</h1><p>${escape(user.email)}</p><div class="account-links">${links}<button class="text-link" id="logout" type="button">Cerrar sesión</button></div>`;
}
