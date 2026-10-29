import {auth} from '../models/auth.js';
import {layoutController} from './layout.js';
import {homeController,catalogController,productController,compareController} from './catalog.js';
import {accountController} from './account.js';
import {checkoutController,ordersController} from './checkout.js';
import {adminController} from './admin.js';
import {contactController} from './contact.js';
import {message} from '../views/common.js';
import {deliveriesController,trackingController} from './deliveries.js';
import {paymentsController} from './payments.js';
const controllers={home:homeController,catalog:catalogController,product:productController,compare:compareController,account:accountController,checkout:checkoutController,orders:ordersController,admin:adminController,deliveries:deliveriesController,tracking:trackingController,payments:paymentsController};
async function renderPage(page){
  try{await controllers[page]?.();}catch(error){message(error.message,true,true);document.querySelectorAll('[data-loading]').forEach(el=>el.textContent='No se pudieron cargar los datos. Intenta nuevamente.');}
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
