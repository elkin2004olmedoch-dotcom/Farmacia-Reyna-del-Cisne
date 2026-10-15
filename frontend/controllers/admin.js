import {administration,adminFormIssues,ecuadorDateTime,ecuadorToday} from '../models/admin.js';
import {catalog} from '../models/catalog.js';
import {tableView,editorView,promotionEditorState,adminSectionView,orderStateView,fiscalView} from '../views/admin.js';
import {promotionPublication} from '../models/promotion-publication.js';
import {message,busy,formErrors} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {requireUser} from './layout.js';
import {auth} from '../models/auth.js';
import {dashboardView,dashboardLoadingView,dashboardErrorView} from '../views/admin-dashboard.js';
import {watchUpdates,preserveFocus} from './updates.js';
import {imageController} from './images.js';
import {billingController} from './billing.js';
import {adminCompanionController} from './admin-companion.js';

const editableSections=['productos','promociones','proveedores','lotes','movimientos'];
const sectionForms={productos:'product-form',promociones:'promotion-form',proveedores:'supplier-form',lotes:'lot-form',movimientos:'movement-form'};
export async function adminController() {
  if(!requireUser('admin.html',true))return;
  document.getElementById('admin-area').hidden=false;
  const requested=new URLSearchParams(location.search).get('tabla');
  let name=[...editableSections,'pedidos','usuarios','detalles','fiscal','facturacion'].includes(requested)?requested:requested?'productos':'dashboard',page=1,result,editing=null,editingVersion=null,summarySnapshot='',requestId=0,openingId=0,previousFocus=null,stateFocus=null,lotRequest=0;
  const dialog=document.getElementById('editor-dialog');const forms=Object.fromEntries(Object.entries(sectionForms).map(([section,id])=>[section,document.getElementById(id)]));
  const productImage=imageController(forms.productos,'product');const promoImage=imageController(forms.promociones,'promotion');
  const stateDialog=document.getElementById('order-state-dialog');const stateForm=document.getElementById('order-state-form');let stateOrder=null;
  const billing=billingController();
  function pharmaceuticalRequired(){const form=forms.productos;form.elements.fundamentoIva.required=form.elements.ivaCategoria.value==='cero';for(const key of ['pvpMaximo','laboratorio','presentacion','registroSanitario'])form.elements[key].required=form.elements.tipoProducto.value==='medicamento';}
  function errors(form,issues){
    if(!auth.isAdmin || !form.isConnected)return false;
    const valid=formErrors(form,issues);
    if(form===forms.productos){const file=document.getElementById('product-image-file');file.setAttribute('aria-invalid',String(Boolean(issues.imagen)));const note=document.getElementById('product-imagen-error');if(note){note.textContent=issues.imagen || '';note.hidden=!issues.imagen;}if(Object.keys(issues)[0]==='imagen')file.focus();}
    return valid;
  }
  async function render({silent=false}={}){
    if(!auth.isAdmin || !document.getElementById('admin-area'))return;
    const id=++requestId;const tableName=name;const tablePage=page;
    if(!silent)adminSectionView(tableName);
    if(tableName==='facturacion'){await billing.render({silent});return;}
    if(tableName==='fiscal'){
      if(silent)return;
      const area=document.getElementById('admin-fiscal');area.setAttribute('aria-busy','true');area.innerHTML='<p class="admin-card admin-empty" role="status">Cargando tarifas y vigencias…</p>';
      try{const loaded=await administration.fiscal();if(id===requestId && auth.isAdmin)fiscalView(loaded);}
      catch(error){if(id!==requestId || !auth.isAdmin)return;area.innerHTML='<p class="admin-card admin-empty">No se pudieron consultar las tarifas. Selecciona Configuración de IVA para volver a intentar.</p>';throw error;}
      finally{if(id===requestId)area.removeAttribute('aria-busy');}return;
    }
    if(tableName==='dashboard'){
      const dashboard=document.getElementById('admin-dashboard');dashboard.setAttribute('aria-busy','true');if(!silent)dashboardLoadingView();
      try{const data=await administration.summary();if(id===requestId && auth.isAdmin){const snapshot=JSON.stringify({...data,generadoEn:null});if(!silent || snapshot!==summarySnapshot){preserveFocus(dashboard,()=>dashboardView(data));summarySnapshot=snapshot;}}}
      catch(error){if(id!==requestId || !auth.isAdmin)return;if(!silent)dashboardErrorView();throw error;}
      finally{if(id===requestId)dashboard.removeAttribute('aria-busy');}return;
    }
    const table=document.getElementById('admin-table');const create=document.getElementById('admin-create');
    table.setAttribute('aria-busy','true');if(!silent){result=null;table.innerHTML='<p class="shop-empty" role="status">Cargando registros…</p>';create.disabled=true;for(const button of ['admin-prev','admin-next'])document.getElementById(button).disabled=true;}
    try{const loaded=await administration.table(tableName,tablePage);if(id!==requestId || !auth.isAdmin || (silent && document.querySelector('dialog[open]')))return;if(!silent || JSON.stringify(loaded)!==JSON.stringify(result)){result=loaded;preserveFocus(table,()=>tableView(tableName,loaded));}create.disabled=false;}
    catch(error){if(id!==requestId || !auth.isAdmin)return;if(!silent)table.innerHTML='<p class="shop-empty">No se pudieron cargar los registros. Selecciona la sección para volver a intentar.</p>';throw error;}
    finally{if(id===requestId)table.removeAttribute('aria-busy');}
  }
  function populate(select,items,{empty=null,label=item=>item.nombre}={}){
    select.replaceChildren();if(empty!==null){const option=document.createElement('option');option.value='';option.textContent=empty;select.append(option);}
    for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=label(item);select.append(option);}select.required=empty===null;
  }
  async function loadMovementLots(){
    const form=forms.movimientos;const id=++lotRequest;const productId=form.elements.productoId.value;const select=form.elements.loteId;const status=document.getElementById('movement-lot-status');const submit=form.querySelector('[type=submit]');
    select.disabled=true;submit.disabled=true;status.textContent='Consultando lotes del producto…';
    try{const data=await administration.lots(productId);if(id!==lotRequest || !auth.isAdmin)return;populate(select,data.items,{empty:'Existencias sin lote',label:lot=>`${lot.numero} · ${lot.stock} unidades · vence ${lot.vencimiento.slice(0,10)}`});status.textContent=data.items.length?'Selecciona el lote correspondiente o las existencias sin lote.':'Este producto todavía no tiene lotes registrados.';select.disabled=false;submit.disabled=false;}
    catch(error){if(id!==lotRequest || !auth.isAdmin)return;status.textContent=error.message;message(error.message,true);}
  }
  async function open(record){
    const id=++openingId;const section=name;const opener=document.activeElement;const choices=['promociones','lotes','movimientos'].includes(section)?await catalog.all():[];
    const suppliers=section==='lotes'?await administration.suppliers():null;
    if(id!==openingId || name!==section || !auth.isAdmin || !dialog.isConnected)return;
    editing=record?.id || null;editingVersion=record?.updatedAt || null;previousFocus=opener;
    for(const [key,form] of Object.entries(forms))form.hidden=key!==section;
    const form=forms[section];if(!form)return;
    if(choices.length || ['promociones','lotes','movimientos'].includes(section))populate(form.elements.productoId,choices);
    if(section==='lotes')populate(form.elements.proveedorId,suppliers.items.filter(s=>s.activo),{empty:'Sin proveedor'});
    editorView(form,record);errors(form,{});document.getElementById('editor-status').textContent='';
    if(section==='productos'){productImage.reset();pharmaceuticalRequired();}
    if(section==='promociones'){promoImage.reset();promotionEditorState(form);}
    if(section==='lotes')form.elements.vencimiento.min=ecuadorToday();
    dialog.showModal();form.querySelector('input:not([type=hidden]),select,textarea')?.focus();
    if(section==='movimientos')await loadMovementLots();
  }
  document.getElementById('admin-create').addEventListener('click',()=>open().catch(error=>message(error.message,true)));
  document.getElementById('admin-dashboard').addEventListener('click',async event=>{if(!event.target.closest('#admin-retry-summary'))return;try{message('');await render();}catch(error){message(error.message,true);}});
  document.getElementById('admin-table-choice').addEventListener('change',async event=>{name=event.target.value;page=1;history.replaceState(null,'','admin.html?tabla='+name);try{await render();}catch(error){message(error.message,true);}});
  for(const [id,offset] of [['admin-prev',-1],['admin-next',1]])document.getElementById(id).addEventListener('click',async()=>{page+=offset;try{await render();}catch(error){message(error.message,true);}});
  forms.productos.elements.ivaCategoria.addEventListener('change',pharmaceuticalRequired);
  forms.productos.elements.tipoProducto.addEventListener('change',pharmaceuticalRequired);
  for(const event of ['input','change'])forms.promociones.addEventListener(event,()=>promotionEditorState(forms.promociones));
  document.getElementById('promotion-publish-discount')?.addEventListener('click',()=>{
    const form=forms.promociones;if(!auth.isAdmin || form.querySelector('[type=submit][aria-busy=true]'))return;
    form.elements.activa.checked=true;form.elements.vistaPrevia.checked=false;promotionEditorState(form);form.requestSubmit();
  });
  forms.movimientos.elements.productoId.addEventListener('change',()=>void loadMovementLots());
  document.getElementById('admin-table').addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    const row=result?.items.find(row=>row.id===(button.dataset.edit || button.dataset.delete || button.dataset.orderState));if(!row)return;
    try{if(button.dataset.orderState){stateFocus=button;stateOrder=row;orderStateView(row);stateDialog.showModal();stateForm.querySelector('select').focus();}else if(button.dataset.edit)await open(row);else if(button.dataset.delete && await confirmAction(`¿Eliminar ${row.nombre || row.titulo}? Los productos vendidos se conservan en el historial.`)){busy(button,true);await (name==='productos'?administration.removeProduct(row.id):administration.removePromotion(row.id));await render();if(auth.isAdmin){document.getElementById('admin-create')?.focus();message('Registro eliminado.');}}}catch(error){message(error.message,true);}finally{if(button.isConnected)busy(button,false);}
  });
  for(const [section,form] of Object.entries(forms))form.addEventListener('submit',async event=>{
    event.preventDefault();if(!auth.isAdmin || !form.isConnected || form.querySelector('[type=submit][aria-busy=true]'))return;
    const status=document.getElementById('editor-status');const image=section==='productos'?productImage:section==='promociones'?promoImage:null;
    if(image?.pending){status.textContent='Espera a que termine de cargar la imagen.';return;}
    const issues=adminFormIssues(form);if(!errors(form,issues)){status.textContent='Revisa los campos indicados antes de guardar.';return;}
    const fields=Object.fromEntries(new FormData(form));let values;
    if(section==='productos')values={...fields,...Object.fromEntries(['codigoInterno','codigoBarras','laboratorio','principioActivo','concentracion','presentacion','registroSanitario','fundamentoIva'].map(key=>[key,fields[key]?.trim() || null])),precio:Number(fields.precio),pvpMaximo:fields.pvpMaximo?Number(fields.pvpMaximo):null,stock:Number(fields.stock),stockMinimo:Number(fields.stockMinimo),descuentoPorcentaje:Number(fields.descuentoPorcentaje),requiereReceta:form.elements.requiereReceta.checked,...(editing?{esperadoUpdatedAt:editingVersion}:{})};
    else if(section==='promociones')values={...fields,imagen:fields.imagen || null,alt:fields.imagen?fields.alt:null,descuentoPorcentaje:Number(fields.descuentoPorcentaje),activa:form.elements.activa.checked,vistaPrevia:form.elements.vistaPrevia.checked,orden:Number(fields.orden),inicio:ecuadorDateTime(fields.inicio),fin:ecuadorDateTime(fields.fin)};
    else if(section==='proveedores')values={...fields,activo:form.elements.activo.checked};
    else if(section==='lotes')values={...fields,cantidad:Number(fields.cantidad),costoUnitario:Number(fields.costoUnitario),proveedorId:fields.proveedorId || null};
    else values={...fields,loteId:fields.loteId || null,cantidad:Number(fields.cantidad)};
    const save={productos:()=>administration.saveProduct(values,editing),promociones:()=>administration.savePromotion(values,editing),proveedores:()=>administration.saveSupplier(values,editing),lotes:()=>administration.saveLot(values),movimientos:()=>administration.saveMovement(values)}[section];
    const submit=form.querySelector('[type=submit]');const locked=Array.from(form.elements).filter(control=>!control.disabled && control!==submit);for(const control of locked)control.disabled=true;busy(submit,true);for(const button of dialog.querySelectorAll('[data-editor-close]'))button.disabled=true;status.textContent='';let serverIssues;
    try{await save();if(!auth.isAdmin || !dialog.isConnected)return;dialog.close();await render();if(auth.isAdmin){message(section==='promociones'?promotionPublication(values).message:'Cambios guardados en la farmacia.');document.getElementById('admin-create')?.focus();}}
    catch(error){status.textContent=error.message;serverIssues=Object.fromEntries((error.details || []).map(issue=>[issue.field,issue.message]));}
    finally{for(const control of locked)control.disabled=false;busy(submit,false);for(const button of dialog.querySelectorAll('[data-editor-close]'))button.disabled=false;if(serverIssues)errors(form,serverIssues);}
  });
  document.getElementById('admin-fiscal').addEventListener('submit',async event=>{
    if(event.target.id!=='fiscal-form')return;event.preventDefault();const form=event.target;const submit=form.querySelector('[type=submit]');if(submit.disabled)return;
    const status=document.getElementById('fiscal-status');const issues=adminFormIssues(form);if(!formErrors(form,issues)){status.textContent='Revisa la tarifa, fecha y respaldo normativo.';return;}
    const fields=Object.fromEntries(new FormData(form));const values={tarifaGeneral:Number(fields.tarifaGeneral),inicioVigencia:ecuadorDateTime(fields.inicioVigencia),referenciaNormativa:fields.referenciaNormativa.trim()};
    if(!await confirmAction(`¿Guardar la tarifa general de ${values.tarifaGeneral} % desde ${fields.inicioVigencia.replace('T',' ')} (Ecuador)? Se conservarán los impuestos de pedidos anteriores.`))return;
    const locked=Array.from(form.elements).filter(control=>!control.disabled && control!==submit);for(const control of locked)control.disabled=true;busy(submit,true);status.textContent='';let serverIssues;
    try{await administration.saveFiscal(values);await render();message('Vigencia de IVA guardada. La nueva tarifa se aplicará desde la fecha indicada.',false,true);}
    catch(error){status.textContent=error.message;serverIssues=Object.fromEntries((error.details || []).map(issue=>[issue.field,issue.message]));}
    finally{for(const control of locked)control.disabled=false;busy(submit,false);if(serverIssues)formErrors(form,serverIssues);}
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
  adminCompanionController({refresh:()=>render({silent:true})});
  const refresh=watchUpdates(()=>render({silent:true}),{canRefresh:()=>auth.isAdmin && !document.querySelector('dialog[open]') && !document.querySelector('#admin-area [aria-busy=true]')});
  dialog.addEventListener('close',()=>{lotRequest++;openingId++;productImage.reset();promoImage.reset();if(!auth.isAdmin || !dialog.isConnected)return;(previousFocus?.isConnected?previousFocus:document.getElementById('admin-create'))?.focus();void refresh();});
  stateDialog.addEventListener('close',()=>{if(!auth.isAdmin || !stateDialog.isConnected)return;if(stateFocus?.isConnected)stateFocus.focus();void refresh();});
  if(new URLSearchParams(location.search).get('crear')==='1' && editableSections.includes(name) && result && auth.isAdmin)await open();
}
