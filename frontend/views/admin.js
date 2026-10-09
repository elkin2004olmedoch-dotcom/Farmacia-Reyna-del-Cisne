import {escape,money} from './common.js';
const columns={
  productos:[['nombre','Producto'],['precio','Precio'],['stock','Stock'],['categoria','Categoría'],['activo','Activo'],['createdAt','Creado']],
  usuarios:[['id','Usuario'],['nombre','Nombre'],['email','Correo'],['telefono','Teléfono'],['role','Rol'],['activo','Activo'],['createdAt','Creado']],
  pedidos:[['id','Pedido'],['userId','Usuario'],['nombre','Comprador'],['email','Correo'],['telefono','Teléfono'],['documento','Documento enmascarado'],['total','Total'],['estado','Estado'],['entrega','Entrega'],['provincia','Provincia'],['ciudad','Ciudad'],['direccion','Dirección'],['codigoPostal','Código postal'],['createdAt','Creado']],
  detalles:[['pedidoId','Pedido'],['productoId','Producto'],['nombreProducto','Nombre al comprar'],['cantidad','Cantidad'],['precioUnitario','Precio unitario'],['precioOriginal','Precio original'],['descuentoPorcentaje','Descuento %']],
  promociones:[['titulo','Campaña'],['productoId','Producto'],['descuentoPorcentaje','Descuento %'],['activa','Activa'],['vistaPrevia','Vista previa'],['inicio','Inicio'],['fin','Fin']],
};
const cell=(key,value)=>['precio','precioUnitario','precioOriginal','total'].includes(key)?money(Math.round(Number(value)*100)):typeof value==='boolean'?(value?'Sí':'No'):value!==null && value!==undefined && value!==''?escape(value):'—';
const sections={productos:['Productos','Gestiona el catálogo, los precios y las existencias de la farmacia.'],promociones:['Promociones','Crea y publica campañas para la tienda; define su orden y vigencia.'],pedidos:['Pedidos de clientes','Consulta todos los pedidos recibidos, sus compradores y los datos de entrega.'],usuarios:['Usuarios','Consulta las cuentas registradas y sus datos de contacto.'],detalles:['Detalles de pedidos','Revisa los productos, cantidades y precios registrados en cada pedido.']};
export function adminSectionView(name) {
  const [title,description]=name==='dashboard'?['Dashboard ejecutivo','Resumen operativo de Farmacia Reina del Cisne.']:sections[name];
  document.getElementById('admin-page-title').textContent=title;document.getElementById('admin-page-description').textContent=description;
  document.getElementById('admin-dashboard').hidden=name!=='dashboard';document.getElementById('admin-records').hidden=name==='dashboard';
  document.getElementById('admin-section-title').textContent=title;document.getElementById('admin-section-description').textContent=description;
  if(name!=='dashboard')document.getElementById('admin-table-choice').value=name;
  for(const link of document.querySelectorAll('[data-admin-section]')){if(link.dataset.adminSection===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  document.getElementById('admin-create').textContent=name==='productos'?'Crear producto →':'Crear promoción →';
  document.getElementById('admin-table').setAttribute('aria-label',title);
}
export function tableView(name,result) {
  const editable=['productos','promociones'].includes(name);const manageOrder=name==='pedidos';const labels=columns[name];
  document.getElementById('admin-table').innerHTML=result.items.length?`<table class="admin-data-table"><caption>${escape(name)} · ${result.total} registros</caption><thead><tr>${labels.map(([key,label])=>`<th scope="col">${label}</th>`).join('')}${editable || manageOrder?'<th scope="col">Acciones</th>':''}</tr></thead><tbody>${result.items.map(row=>`<tr>${labels.map(([key])=>`<td>${cell(key,row[key])}</td>`).join('')}${editable?`<td><button class="text-link" data-edit="${escape(row.id)}" aria-label="Editar ${escape(row.nombre || row.titulo)}" ${row.activo===false?'disabled':''}>Editar</button><button class="text-link" data-delete="${escape(row.id)}" aria-label="Eliminar ${escape(row.nombre || row.titulo)}" ${row.activo===false?'disabled':''}>Eliminar</button></td>`:manageOrder?`<td><button class="text-link" data-order-state="${escape(row.id)}" aria-label="Gestionar estado del pedido ${escape(row.id.slice(0,8))}">Gestionar estado</button></td>`:''}</tr>`).join('')}</tbody></table>`:'<p class="shop-empty">No hay registros en esta tabla.</p>';
  document.getElementById('admin-page-info').textContent=`Página ${result.page} · ${result.total} registros`;
  document.getElementById('admin-prev').disabled=result.page<=1;document.getElementById('admin-next').disabled=result.page*result.pageSize>=result.total;
  document.getElementById('admin-create').hidden=!editable;
}
export function editorView(form,values={}) {
  form.reset();for(const [key,value] of Object.entries(values)){const field=form.elements.namedItem(key);if(!field)continue;if(field.type==='checkbox')field.checked=value;else if(field.type==='datetime-local')field.value=value?localTime(value):'';else field.value=value??'';}
  document.getElementById('editor-title').textContent=(values.id?'Editar ':'Crear ')+(form.id==='product-form'?'producto':'promoción');
}
const localTime=value=>{const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};

export function imagePreviewView(prefix,path){
  const image=document.getElementById(prefix+'-image-preview');
  const valid=/^assets\/(?:images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)|uploads\/[a-f0-9-]+\.webp)$/.test(path || '');
  image.hidden=!valid;if(valid)image.src=path;else image.removeAttribute('src');
}
const stateLabels={pendiente:'Pendiente',confirmado:'Confirmado',preparado:'Preparado',entregado:'Entregado',cancelado:'Cancelado'};
export function orderStateView(order){
  const transitions={pendiente:['confirmado','cancelado'],confirmado:['preparado','cancelado'],preparado:['entregado','cancelado'],entregado:[],cancelado:[]};
  document.getElementById('order-state-current').textContent=`Pedido ${order.id.slice(0,8)} · Estado actual: ${stateLabels[order.estado] || order.estado}`;
  const choices=transitions[order.estado] || [];const select=document.getElementById('order-state');
  select.innerHTML=choices.length?choices.map(state=>`<option value="${state}">${stateLabels[state]}</option>`).join(''):'<option value="">Estado final: no admite cambios</option>';
  select.disabled=!choices.length;document.querySelector('#order-state-form [type=submit]').disabled=!choices.length;
  document.getElementById('order-state-status').textContent='';
  const history=order.historial || [];
  document.getElementById('order-state-history').innerHTML=history.length?`<ol>${history.map(item=>`<li>${escape(stateLabels[item.estado] || item.estado)} · ${escape(new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short',timeZone:'America/Guayaquil'}).format(new Date(item.createdAt)))}</li>`).join('')}</ol>`:'<p>Sin cambios de estado registrados.</p>';
}
