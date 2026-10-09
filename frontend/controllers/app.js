import {auth} from '../models/auth.js';
import {layoutController} from './layout.js';
import {homeController,catalogController,productController,compareController} from './catalog.js';
import {accountController} from './account.js';
import {checkoutController,ordersController} from './checkout.js';
import {adminController} from './admin.js';
import {contactController} from './contact.js';
import {message} from '../views/common.js';
const controllers={home:homeController,catalog:catalogController,product:productController,compare:compareController,account:accountController,checkout:checkoutController,orders:ordersController,admin:adminController};
async function initialize() {
  try{await auth.restore();}catch(error){if(error.status===401)auth.clear();else message(error.message,true);}
  const page=document.body.dataset.page;
  if(auth.isAdmin && ['account','checkout','orders'].includes(page)){location.replace(page==='orders'?'admin.html?tabla=pedidos':'admin.html');return;}
  layoutController();contactController();
  try{await controllers[page]?.();}catch(error){message(error.message,true,true);document.querySelectorAll('[data-loading]').forEach(el=>el.textContent='No se pudieron cargar los datos. Intenta nuevamente.');}
}
initialize();
