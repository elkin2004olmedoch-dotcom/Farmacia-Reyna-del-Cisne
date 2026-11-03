import {escape,privateEmail} from './common.js';
export function sessionView(user,count) {
  const admin=user?.role==='admin',courier=user?.role==='repartidor';document.body.dataset.sessionRole=admin?'admin':courier?'repartidor':user?'user':'guest';
  const accountToggle=document.getElementById('account-menu-toggle');if(accountToggle)accountToggle.hidden=admin||courier;
  for(const link of document.querySelectorAll('[data-staff-account]'))link.hidden=!admin&&!courier;
  const profileHost=document.querySelector('.account-menu-wrap,.admin-topbar-inner');
  if(profileHost && (admin||courier) && !profileHost.querySelector('[data-staff-profile]')){const link=document.createElement('a');link.href='cuenta.html';link.textContent='Perfil';link.dataset.staffProfile='';link.className='admin-store-link';profileHost.append(link);}
  for(const link of document.querySelectorAll('[data-staff-profile]'))link.hidden=!admin&&!courier;
  for(const link of document.querySelectorAll('[data-account-link]')){link.textContent=admin?'Panel':courier?'Mis entregas':user?`Hola, ${user.nombre.split(' ')[0]}`:'Ingresar';link.href=admin?'admin.html':courier?'entregas.html':'cuenta.html';}
  for(const link of document.querySelectorAll('[data-deliveries-link]'))link.hidden=!admin && !courier;
  for(const link of document.querySelectorAll('a[href="pedidos.html"]'))if(courier){link.href='entregas.html';link.textContent='Mis entregas';}
  for(const link of document.querySelectorAll('[data-admin-link]'))link.hidden=user?.role!=='admin';
  for(const element of document.querySelectorAll('[data-admin-session]'))element.hidden=!admin;
  for(const element of document.querySelectorAll('[data-admin-guest]'))element.hidden=admin;
  for(const element of document.querySelectorAll('[data-admin-name]'))element.textContent=user?.nombre || '';
  for(const element of document.querySelectorAll('[data-admin-email]'))element.textContent=user?privateEmail(user.email):'';
  for(const counter of document.querySelectorAll('[data-shop-count]'))counter.textContent=count;
  for(const link of document.querySelectorAll('.shop-cart'))link.setAttribute('aria-label',`Carrito, ${count} unidades`);
  const dock=document.getElementById('cart-dock');
  if(dock){
    dock.hidden=!count || admin || courier || document.body.hasAttribute('data-session-pending');
    document.getElementById('cart-dock-summary').textContent=`${count} ${count===1?'unidad':'unidades'}`;
    document.body.toggleAttribute('data-cart-dock',!dock.hidden);
  }
}
export function accountView(user) {
  const panel=document.getElementById('account-area');
  const links=user.role==='admin'?'<a href="admin.html" class="button button-primary">Administrar farmacia →</a><a href="index.html" class="button button-outline">Ver tienda →</a>':user.role==='repartidor'?'<a href="entregas.html" class="button button-primary">Mis entregas →</a>':'<a href="pedidos.html" class="button button-primary">Ver mis pedidos →</a><a href="checkout.html" class="button button-outline">Continuar mi compra →</a>';
  panel.innerHTML=`<p class="eyebrow">${user.role==='admin'?'Gestión de la farmacia':'Tu farmacia en línea'}</p><h1 id="profile-greeting">Hola, ${escape(user.nombre)}.</h1><p>${escape(privateEmail(user.email))}</p><h2>Mi perfil</h2><form id="profile-form" class="shop-form" novalidate><div class="shop-field"><label for="profile-name">Nombre completo</label><input id="profile-name" name="nombre" autocomplete="name" required minlength="2" maxlength="80" value="${escape(user.nombre)}" aria-describedby="profile-name-error"><span class="field-error" id="profile-name-error" hidden></span></div><div class="shop-field"><label for="profile-phone">Teléfono ecuatoriano</label><input id="profile-phone" name="telefono" type="tel" autocomplete="tel" required maxlength="25" value="${escape(user.telefono)}" aria-describedby="profile-phone-help profile-phone-error"><small id="profile-phone-help">09XXXXXXXX, fijo con código de área o +593.</small><span class="field-error" id="profile-phone-error" hidden></span></div><button class="button button-primary" type="submit">Guardar cambios</button><button class="button button-outline" type="button" id="profile-cancel">Cancelar cambios</button><p id="profile-status" role="status" aria-live="polite"></p></form><div class="account-links">${links}<button class="text-link" id="logout" type="button">Cerrar sesión</button></div>`;
}
