import {administration} from '../models/admin.js';
import {catalog} from '../models/catalog.js';
import {tableView,editorView,adminSectionView} from '../views/admin.js';
import {message,busy,formErrors} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {requireUser} from './layout.js';
import {auth} from '../models/auth.js';
export async function adminController() {
  if(!requireUser('admin.html',true))return;
  document.getElementById('admin-area').hidden=false;
  const requested=new URLSearchParams(location.search).get('tabla');
  let name=['productos','promociones','pedidos','usuarios','detalles'].includes(requested)?requested:'productos',page=1,result,editing=null,requestId=0;
  const dialog=document.getElementById('editor-dialog');const productForm=document.getElementById('product-form');const promoForm=document.getElementById('promotion-form');
  async function render(){
    const id=++requestId;const tableName=name;const tablePage=page;
    const table=document.getElementById('admin-table');const create=document.getElementById('admin-create');
    result=null;adminSectionView(tableName);table.setAttribute('aria-busy','true');table.innerHTML='<p class="shop-empty" role="status">Cargando registros…</p>';create.disabled=true;
    for(const button of ['admin-prev','admin-next'])document.getElementById(button).disabled=true;
    try{const loaded=await administration.table(tableName,tablePage);if(id!==requestId || !auth.isAdmin)return;result=loaded;tableView(tableName,loaded);create.disabled=false;}
    catch(error){if(id!==requestId || !auth.isAdmin)return;table.innerHTML='<p class="shop-empty">No se pudieron cargar los registros. Selecciona la sección para volver a intentar.</p>';throw error;}
    finally{if(id===requestId)table.removeAttribute('aria-busy');}
  }
  async function open(record){
    editing=record?.id || null;const product=name==='productos';productForm.hidden=!product;promoForm.hidden=product;
    if(!product){const select=promoForm.elements.productoId;select.replaceChildren();for(const item of await catalog.all()){const option=document.createElement('option');option.value=item.id;option.textContent=item.nombre;select.append(option);}}
    const form=product?productForm:promoForm;editorView(form,record);formErrors(form,{});document.getElementById('editor-status').textContent='';dialog.showModal();form.querySelector('input').focus();
  }
  document.getElementById('admin-create').addEventListener('click',()=>open().catch(error=>message(error.message,true)));
  document.getElementById('admin-table-choice').addEventListener('change',async event=>{name=event.target.value;page=1;history.replaceState(null,'','admin.html?tabla='+name);try{await render();}catch(error){message(error.message,true);}});
  for(const [id,offset] of [['admin-prev',-1],['admin-next',1]])document.getElementById(id).addEventListener('click',async()=>{page+=offset;try{await render();}catch(error){message(error.message,true);}});
  document.getElementById('admin-table').addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    const row=result.items.find(row=>row.id===(button.dataset.edit || button.dataset.delete));
    try{if(button.dataset.edit)await open(row);else if(button.dataset.delete && await confirmAction(`¿Eliminar ${row.nombre || row.titulo}? Los productos vendidos se conservan en el historial.`)){busy(button,true);await (name==='productos'?administration.removeProduct(row.id):administration.removePromotion(row.id));await render();document.getElementById('admin-create').focus();message('Registro eliminado.');}}catch(error){message(error.message,true);}finally{if(button.isConnected)busy(button,false);}
  });
  for(const form of [productForm,promoForm])form.addEventListener('submit',async event=>{
    event.preventDefault();const fields=Object.fromEntries(new FormData(form));const product=form===productForm;
    const values=product?{...fields,precio:Number(fields.precio),stock:Number(fields.stock)}:{...fields,activa:form.elements.activa.checked,vistaPrevia:form.elements.vistaPrevia.checked,orden:Number(fields.orden),inicio:fields.inicio?new Date(fields.inicio).toISOString():null,fin:fields.fin?new Date(fields.fin).toISOString():null};
    const submit=form.querySelector('[type=submit]');busy(submit,true);document.getElementById('editor-status').textContent='';
    try{await (product?administration.saveProduct(values,editing):administration.savePromotion(values,editing));dialog.close();await render();message('Cambios guardados en la farmacia.');document.getElementById('admin-create').focus();}
    catch(error){document.getElementById('editor-status').textContent=error.message;formErrors(form,Object.fromEntries((error.details||[]).map(issue=>[issue.field,issue.message])));}finally{busy(submit,false);}
  });
  for(const button of document.querySelectorAll('[data-editor-close]'))button.addEventListener('click',()=>dialog.close());
  await render();
}
