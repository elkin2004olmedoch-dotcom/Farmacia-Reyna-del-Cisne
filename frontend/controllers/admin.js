import {administration} from '../models/admin.js';
import {catalog} from '../models/catalog.js';
import {tableView,editorView,adminSectionView,orderStateView} from '../views/admin.js';
import {message,busy,formErrors} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {requireUser} from './layout.js';
import {auth} from '../models/auth.js';
import {dashboardView,dashboardLoadingView,dashboardErrorView} from '../views/admin-dashboard.js';
import {watchUpdates,preserveFocus} from './updates.js';
import {imageController} from './images.js';
export async function adminController() {
  if(!requireUser('admin.html',true))return;
  document.getElementById('admin-area').hidden=false;
  const requested=new URLSearchParams(location.search).get('tabla');
  let name=['productos','promociones','pedidos','usuarios','detalles'].includes(requested)?requested:requested?'productos':'dashboard',page=1,result,editing=null,editingVersion=null,summarySnapshot='',requestId=0,openingId=0;
  const dialog=document.getElementById('editor-dialog');const productForm=document.getElementById('product-form');const promoForm=document.getElementById('promotion-form');
  const productImage=imageController(productForm,'product');const promoImage=imageController(promoForm,'promotion');
  const stateDialog=document.getElementById('order-state-dialog');const stateForm=document.getElementById('order-state-form');let stateOrder=null;
  async function render({silent=false}={}){
    const id=++requestId;const tableName=name;const tablePage=page;
    if(!silent)adminSectionView(tableName);
    if(tableName==='dashboard'){
      const dashboard=document.getElementById('admin-dashboard');dashboard.setAttribute('aria-busy','true');if(!silent)dashboardLoadingView();
      try{const data=await administration.summary();if(id===requestId && auth.isAdmin){const snapshot=JSON.stringify({...data,generadoEn:null});if(!silent || snapshot!==summarySnapshot){preserveFocus(dashboard,()=>dashboardView(data));summarySnapshot=snapshot;}}}
      catch(error){if(id!==requestId || !auth.isAdmin)return;if(!silent)dashboardErrorView();throw error;}
      finally{if(id===requestId)dashboard.removeAttribute('aria-busy');}
      return;
    }
    const table=document.getElementById('admin-table');const create=document.getElementById('admin-create');
    table.setAttribute('aria-busy','true');if(!silent){result=null;table.innerHTML='<p class="shop-empty" role="status">Cargando registros…</p>';create.disabled=true;for(const button of ['admin-prev','admin-next'])document.getElementById(button).disabled=true;}
    try{const loaded=await administration.table(tableName,tablePage);if(id!==requestId || !auth.isAdmin || (silent && document.querySelector('dialog[open]')))return;if(!silent || JSON.stringify(loaded)!==JSON.stringify(result)){result=loaded;preserveFocus(table,()=>tableView(tableName,loaded));}create.disabled=false;}
    catch(error){if(id!==requestId || !auth.isAdmin)return;if(!silent)table.innerHTML='<p class="shop-empty">No se pudieron cargar los registros. Selecciona la sección para volver a intentar.</p>';throw error;}
    finally{if(id===requestId)table.removeAttribute('aria-busy');}
  }
  async function open(record){
    const id=++openingId;const section=name;const product=section==='productos';const choices=product?[]:await catalog.all();
    if(id!==openingId || name!==section || !auth.isAdmin)return;
    editing=record?.id || null;editingVersion=record?.updatedAt || null;productForm.hidden=!product;promoForm.hidden=product;
    if(!product){const select=promoForm.elements.productoId;select.replaceChildren();for(const item of choices){const option=document.createElement('option');option.value=item.id;option.textContent=item.nombre;select.append(option);}}
    const form=product?productForm:promoForm;editorView(form,record);(product?productImage:promoImage).reset();formErrors(form,{});document.getElementById('editor-status').textContent='';dialog.showModal();form.querySelector('input').focus();
  }
  document.getElementById('admin-create').addEventListener('click',()=>open().catch(error=>message(error.message,true)));
  document.getElementById('admin-dashboard').addEventListener('click',async event=>{if(!event.target.closest('#admin-retry-summary'))return;try{message('');await render();}catch(error){message(error.message,true);}});
  document.getElementById('admin-table-choice').addEventListener('change',async event=>{name=event.target.value;page=1;history.replaceState(null,'','admin.html?tabla='+name);try{await render();}catch(error){message(error.message,true);}});
  for(const [id,offset] of [['admin-prev',-1],['admin-next',1]])document.getElementById(id).addEventListener('click',async()=>{page+=offset;try{await render();}catch(error){message(error.message,true);}});
  document.getElementById('admin-table').addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    const row=result?.items.find(row=>row.id===(button.dataset.edit || button.dataset.delete || button.dataset.orderState));if(!row)return;
    try{if(button.dataset.orderState){stateOrder=row;orderStateView(row);stateDialog.showModal();stateForm.querySelector('select').focus();}else if(button.dataset.edit)await open(row);else if(button.dataset.delete && await confirmAction(`¿Eliminar ${row.nombre || row.titulo}? Los productos vendidos se conservan en el historial.`)){busy(button,true);await (name==='productos'?administration.removeProduct(row.id):administration.removePromotion(row.id));await render();document.getElementById('admin-create').focus();message('Registro eliminado.');}}catch(error){message(error.message,true);}finally{if(button.isConnected)busy(button,false);}
  });
  for(const form of [productForm,promoForm])form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.querySelector('[type=submit][aria-busy=true]'))return;const fields=Object.fromEntries(new FormData(form));const product=form===productForm;
    if((product?productImage:promoImage).pending){document.getElementById('editor-status').textContent='Espera a que termine de cargar la imagen.';return;}
    if(product && !fields.imagen){document.getElementById('editor-status').textContent='Selecciona una imagen para el producto.';document.getElementById('product-image-file').focus();return;}
    const values=product?{...fields,precio:Number(fields.precio),stock:Number(fields.stock),...(editing?{esperadoUpdatedAt:editingVersion}:{})}:{...fields,imagen:fields.imagen || null,alt:fields.imagen?fields.alt:null,descuentoPorcentaje:Number(fields.descuentoPorcentaje),activa:form.elements.activa.checked,vistaPrevia:form.elements.vistaPrevia.checked,orden:Number(fields.orden),inicio:fields.inicio?new Date(fields.inicio).toISOString():null,fin:fields.fin?new Date(fields.fin).toISOString():null};
    const submit=form.querySelector('[type=submit]');const locked=Array.from(form.elements).filter(control=>!control.disabled && control!==submit);for(const control of locked)control.disabled=true;busy(submit,true);for(const button of dialog.querySelectorAll('[data-editor-close]'))button.disabled=true;document.getElementById('editor-status').textContent='';
    try{await (product?administration.saveProduct(values,editing):administration.savePromotion(values,editing));dialog.close();await render();message('Cambios guardados en la farmacia.');document.getElementById('admin-create').focus();}
    catch(error){document.getElementById('editor-status').textContent=error.message;formErrors(form,Object.fromEntries((error.details||[]).map(issue=>[issue.field,issue.message])));}finally{for(const control of locked)control.disabled=false;busy(submit,false);for(const button of dialog.querySelectorAll('[data-editor-close]'))button.disabled=false;}
  });
  stateForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!stateOrder || !auth.isAdmin || stateForm.querySelector('[type=submit][aria-busy=true]'))return;
    const estado=stateForm.elements.estado.value;if(!estado)return;
    if(estado==='cancelado' && !await confirmAction('¿Cancelar este pedido y devolver sus unidades al inventario?'))return;
    const submit=stateForm.querySelector('[type=submit]');busy(submit,true);stateForm.elements.estado.disabled=true;stateForm.querySelector('[data-state-close]').disabled=true;
    try{const saved=await administration.changeOrderState(stateOrder.id,estado,stateOrder.updatedAt);stateOrder=saved;stateDialog.close();await render();message('Estado actualizado. El cliente podrá verlo en Mis pedidos.');document.querySelector(`[data-order-state="${CSS.escape(saved.id)}"]`)?.focus();}
    catch(error){document.getElementById('order-state-status').textContent=error.message;}
    finally{busy(submit,false);stateForm.elements.estado.disabled=false;stateForm.querySelector('[data-state-close]').disabled=false;}
  });
  dialog.addEventListener('cancel',event=>{if(!productImage.pending && !promoImage.pending && dialog.querySelector('[type=submit][aria-busy=true]'))event.preventDefault();});
  stateDialog.addEventListener('cancel',event=>{if(stateForm.querySelector('[type=submit][aria-busy=true]'))event.preventDefault();});
  for(const button of document.querySelectorAll('[data-state-close]'))button.addEventListener('click',()=>stateDialog.close());
  for(const button of document.querySelectorAll('[data-editor-close]'))button.addEventListener('click',()=>dialog.close());
  await render();
  const refresh=watchUpdates(()=>render({silent:true}),{canRefresh:()=>auth.isAdmin && !document.querySelector('dialog[open]') && !document.querySelector('#admin-area [aria-busy=true]')});
  dialog.addEventListener('close',()=>{productImage.reset();promoImage.reset();void refresh();});
  stateDialog.addEventListener('close',()=>{void refresh();});
  if(new URLSearchParams(location.search).get('crear')==='1' && ['productos','promociones'].includes(name) && result && auth.isAdmin)await open();
}
