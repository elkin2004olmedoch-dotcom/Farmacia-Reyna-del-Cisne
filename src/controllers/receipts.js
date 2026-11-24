import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {message} from '../views/common.js';
import {orderReceiptView} from '../views/receipts.js';
import {orders as orderApi} from '../models/orders.js';

const connections=new WeakMap();

/** Connect once per area, then replace its available DTOs after every order refresh. */
export function connectOrderReceipts(area){
  if(!area)return ()=>{};
  if(connections.has(area))return connections.get(area);
  const orders=new Map();
  let dialog=null,opener=null,selectedId=null,printRoot=null;
  function clearPrint(){printRoot?.replaceChildren();printRoot?.remove();printRoot=null;document.body.classList.remove('order-receipt-print');}
  function close({restoreFocus=true}={}){
    clearPrint();if(!dialog)return;
    const current=dialog,id=selectedId,previous=opener;dialog=null;selectedId=null;opener=null;
    current.replaceChildren();if(current.open)current.close();current.remove();
    if(restoreFocus){
      const next=previous?.isConnected?previous:[...area.querySelectorAll('[data-order-receipt]')].find(button=>button.dataset.orderReceipt===id);
      if(next && !next.disabled && next.getClientRects().length)next.focus({preventScroll:true});
    }
  }
  function invalidate(){orders.clear();close({restoreFocus:false});}
  function preparePrint(){
    clearPrint();
    const sheet=dialog?.querySelector('.order-receipt-sheet');
    if(!sheet || !auth.user || !orders.has(selectedId))return false;
    // A normal body child paginates reliably; the modal's top layer must not clip long orders.
    printRoot=document.createElement('div');printRoot.className='order-receipt-print-root';printRoot.setAttribute('aria-hidden','true');printRoot.append(sheet.cloneNode(true));document.body.append(printRoot);document.body.classList.add('order-receipt-print');return true;
  }
  area.addEventListener('click',event=>{
    const button=event.target.closest('[data-order-receipt]');if(!button || button.disabled || !area.contains(button))return;
    event.preventDefault();const order=orders.get(button.dataset.orderReceipt);
    if(!auth.user || !order){message('Actualiza tus pedidos e inicia sesión para consultar el comprobante.',true);return;}
    close({restoreFocus:false});opener=button;selectedId=order.id;
    const current=document.createElement('dialog');dialog=current;current.className='order-receipt-dialog';current.setAttribute('aria-labelledby','order-receipt-dialog-title');
    current.innerHTML=`<div class="receipt-dialog-toolbar"><div><h2 id="order-receipt-dialog-title">Comprobante del pedido</h2><p>Para descargarlo, elige «Guardar como PDF» en la ventana de impresión.</p></div><div class="receipt-dialog-actions"><button type="button" class="button button-primary" data-receipt-print>Guardar PDF / imprimir</button><button type="button" class="button button-outline" data-receipt-email>Enviar a mi correo</button><button type="button" class="button button-outline" data-receipt-close>Cerrar</button></div></div><p data-receipt-email-status role="status" aria-live="polite"></p>${orderReceiptView(order)}`;
    current.addEventListener('click',async click=>{
      const emailButton=click.target.closest('[data-receipt-email]');
      if(emailButton){
        if(emailButton.disabled)return;
        const status=current.querySelector('[data-receipt-email-status]');emailButton.disabled=true;status.textContent='Solicitando envío…';
        try{const result=await orderApi.email(order.id);if(dialog!==current)return;status.textContent=({accepted:'El proveedor aceptó el envío a tu correo registrado. Revisa también la carpeta de spam.',disabled:'El envío de correos todavía no está habilitado. Puedes guardar el comprobante como PDF.',verification_required:'Primero debes confirmar el correo de tu cuenta.',unavailable:'No se pudo enviar. Tu pedido está guardado; vuelve a intentarlo más tarde.'})[result.status] || 'No se pudo completar el envío.';}
        catch(error){if(dialog===current)status.textContent=error.message || 'No se pudo solicitar el envío.';}
        finally{if(dialog===current)emailButton.disabled=false;}
        return;
      }
      if(click.target.closest('[data-receipt-close]')){close();return;}
      if(click.target.closest('[data-receipt-print]')){if(preparePrint()){try{window.print();}catch{clearPrint();message('No se pudo abrir la impresión. Inténtalo nuevamente desde el comprobante.',true);}}return;}
      if(click.target===current){const bounds=current.getBoundingClientRect();if(click.clientX<bounds.left || click.clientX>bounds.right || click.clientY<bounds.top || click.clientY>bounds.bottom)close();}
    });
    current.addEventListener('cancel',cancel=>{cancel.preventDefault();close();});
    current.addEventListener('close',()=>{if(dialog===current)close();});
    document.body.append(current);current.showModal();current.querySelector('[data-receipt-close]').focus();
  });
  events.addEventListener('session:expired',invalidate);events.addEventListener('session:changed',invalidate);
  window.addEventListener('beforeprint',()=>{if(dialog?.open)preparePrint();});window.addEventListener('afterprint',clearPrint);
  window.addEventListener('pagehide',()=>close({restoreFocus:false}));
  const updateReceipts=values=>{
    close();orders.clear();
    for(const order of Array.isArray(values)?values:[])if(order && typeof order.id==='string' && Array.isArray(order.detalles))orders.set(order.id,order);
  };
  connections.set(area,updateReceipts);return updateReceipts;
}
