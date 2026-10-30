import {auth} from '../models/auth.js';
import {layoutController} from './layout.js';
import {contactController} from './contact.js';
import {message} from '../views/common.js';
// Native module imports keep each screen's dependencies out of unrelated pages.
const controllers={
  home:()=>import('./catalog.js').then(module=>module.homeController()),
  catalog:()=>import('./catalog.js').then(module=>module.catalogController()),
  product:()=>import('./catalog.js').then(module=>module.productController()),
  compare:()=>import('./catalog.js').then(module=>module.compareController()),
  account:()=>import('./account.js').then(module=>module.accountController()),
  checkout:()=>import('./checkout.js').then(module=>module.checkoutController()),
  orders:()=>import('./checkout.js').then(module=>module.ordersController()),
  admin:()=>import('./admin.js').then(module=>module.adminController()),
  deliveries:()=>import('./deliveries.js').then(module=>module.deliveriesController()),
  tracking:()=>import('./deliveries.js').then(module=>module.trackingController()),
  payments:()=>import('./payments.js').then(module=>module.paymentsController())
};
async function renderPage(page){
  try{
    if(Object.hasOwn(controllers,page))await controllers[page]();
    const controls=document.getElementById('screen-controls');
    if(controls)controls.disabled=false;
    document.getElementById('contenido').inert=false;
  }catch(error){message(error.message,true,true);document.querySelectorAll('[data-loading]').forEach(el=>el.textContent='No se pudieron cargar los datos. Intenta nuevamente.');}
}
async function initialize() {
  const page=document.body.dataset.page;
  let updateSession;
  if(page==='home'){
    document.body.dataset.sessionPending='';updateSession=layoutController();contactController();void renderPage(page);
  }
  try{await auth.restore();delete document.body.dataset.sessionPending;}catch(error){if(error.status===401){auth.clear();delete document.body.dataset.sessionPending;}else message(error.message,true);}
  if(auth.isAdmin && ['account','checkout','orders'].includes(page)){location.replace(page==='orders'?'admin.html?tabla=pedidos':'admin.html');return;}
  if(auth.isCourier && ['account','checkout','orders','admin','payments'].includes(page)){location.replace('entregas.html');return;}
  if(updateSession)updateSession();else{layoutController();contactController();}
  if(!['admin','deliveries','tracking'].includes(page) && !auth.isStaff && !document.body.hasAttribute('data-session-pending'))import('./mascota.js').then(({mascotaController})=>mascotaController()).catch(()=>{});
  if(page!=='home')await renderPage(page);
}
initialize();
