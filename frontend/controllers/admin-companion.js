import {auth} from '../models/auth.js';
import {administration} from '../models/admin.js';
import {events} from '../models/events.js';
import {interpretAdminCommand,ecuadorCommandDay} from './admin-command.mjs';
import {deliveries} from '../models/deliveries.js';

const ASSETS=new URL('../assets/mascotas/',import.meta.url);

function productValues(product,changes){
  return {
    nombre:product.nombre,precio:Number(product.precio),stock:Number(product.stock),categoria:product.categoria,
    descripcion:product.descripcion,imagen:product.imagen,alt:product.alt,
    descuentoPorcentaje:Number(product.descuentoPorcentaje||0),ivaCategoria:product.ivaCategoria||'general',
    fundamentoIva:product.fundamentoIva??null,tipoProducto:product.tipoProducto||'cuidado',
    codigoInterno:product.codigoInterno??null,codigoBarras:product.codigoBarras??null,
    laboratorio:product.laboratorio??null,principioActivo:product.principioActivo??null,
    concentracion:product.concentracion??null,presentacion:product.presentacion??null,
    registroSanitario:product.registroSanitario??null,requiereReceta:Boolean(product.requiereReceta),
    controlado:Boolean(product.controlado),biologico:Boolean(product.biologico),cadenaFrio:Boolean(product.cadenaFrio),
    stockMinimo:Number(product.stockMinimo??5),pvpMaximo:product.pvpMaximo==null?null:Number(product.pvpMaximo),
    esperadoUpdatedAt:product.updatedAt,...changes,
  };
}

const instructions={
  product:'Actualiza el precio de "Vitaminas diarias" a 13,50 y el stock a 24. Modifica producto "Vitaminas diarias": descripcion="Descripción real". Desactiva producto "Vitaminas diarias".',
  promotion:'Publica promoción de 20 % para "Vitaminas diarias" hasta 2026-12-31 titulada "Fin de año". La fecha usa hora de Ecuador.',
  records:'Altas: crea producto: nombre="Gel"; precio=2; stock=20; categoria=cuidado; tipoProducto=cuidado; descripcion="Gel de manos"; imagen="assets/images/gel.webp"; alt="Frasco de gel"; ivaCategoria=general. La imagen debe existir. Si falta información abro el formulario. Para medicamentos exige PVP, laboratorio, presentación, registro y clasificación sanitaria reales.',
  inventory:'Crea proveedor: nombre="Distribuidora"; ruc="RUC real"; email="ventas@example.com"; telefono="0991234567"; direccion="Calle Central s/n"; activo=true. Registra lote: producto="Vitaminas diarias"; numero="L-01"; vencimiento=2027-12-31; cantidad=20; costoUnitario=1,25. Ajusta inventario: producto="Vitaminas diarias"; tipo=salida; cantidad=2; motivo="Rotura de envase". Opcionales: proveedorId en lote, loteId en ajuste.',
  navigation:'Abre proveedores. Abre formulario de producto. Cambia pedido "ID" a preparado. Abre entregas para zonas y repartidores. Asigna pedido "ID" a repartidor "ID". Cambia entrega "ID" a en_destino. Crea zona: nombre="Puerto Quito"; provincia="Pichincha"; canton="Puerto Quito"; tarifaCentavos=250; ivaCategoria=general; activa=true. Modifica zona "ID": tarifaCentavos=300. Usa identificadores reales del panel.',
};

/** Executes only parsed operations through the same authenticated models as the forms. */
export function createAdminCommandExecutor({model=administration,deliveryModel=deliveries,isAdmin=()=>auth.isAdmin,refresh=()=>{},navigate,openEditor}={}){
  let pending=false;
  const requireAdmin=()=>{if(!isAdmin())throw new Error('Inicia sesión nuevamente como administrador.');};
  const reply=text=>({type:'reply',text});
  async function findDelivery(predicate){
    let page=1;
    while(true){const data=await deliveryModel.list(page++);requireAdmin();const found=data.items.find(predicate);if(found)return found;if(!data.items.length||(page-1)*data.pageSize>=data.total||data.items.length>=data.total)return null;}
  }
  return async text=>{
    requireAdmin();if(pending)throw new Error('Espera a que termine la orden anterior.');pending=true;
    try{
      let command=interpretAdminCommand(text);
      if(command.type==='needs-products'){const products=await model.products();requireAdmin();command=interpretAdminCommand(text,products);}
      if(command.type==='help')return reply(Object.values(instructions).join('\n\n'));
      if(['off-topic','needs-details'].includes(command.type))return reply(command.message);
      if(command.type==='navigate'){if(!navigate)throw new Error('La navegación del panel no está disponible.');await navigate(command.section);return reply('Sección abierta.');}
      if(command.type==='open-editor'){if(!openEditor)throw new Error('El formulario del panel no está disponible.');await openEditor(command.section,command.values,command.record);return reply(command.message||'Formulario abierto. Completa los datos reales y guarda el registro.');}
      requireAdmin();let message='Registro guardado en la farmacia.';
      switch(command.type){
        case 'update-product':
          if(!command.product.activo)return reply('Ese producto está inactivo. Revísalo desde Productos.');
          await model.saveProduct(productValues(command.product,command.changes),command.product.id);message=`Producto actualizado: ${command.product.nombre}.`;break;
        case 'create-product':await model.saveProduct(command.values);message=`Producto creado: ${command.values.nombre}.`;break;
        case 'deactivate-product':await model.removeProduct(command.product.id);message=`Producto desactivado: ${command.product.nombre}.`;break;
        case 'create-promotion':await model.savePromotion(command.values);message=`Promoción publicada: ${command.values.titulo}, ${command.values.descuentoPorcentaje} % para ${command.product.nombre}, hasta ${ecuadorCommandDay(command.values.fin)} (hora de Ecuador).`;break;
        case 'create-supplier':await model.saveSupplier(command.values);break;
        case 'create-lot':await model.saveLot(command.values);message='Lote registrado y existencias actualizadas.';break;
        case 'create-movement':await model.saveMovement(command.values);message='Ajuste registrado en el historial de inventario.';break;
        case 'change-order-state':{
          const order=await model.order(command.id);requireAdmin();
          if(!order?.updatedAt)throw new Error('No se pudo consultar la versión actual del pedido.');
          await model.changeOrderState(command.id,command.estado,order.updatedAt);message=`Pedido actualizado a ${command.estado}.`;break;
        }
        case 'create-zone':await deliveryModel.saveZone({...command.values,fundamentoIva:command.values.fundamentoIva??null});message='Zona y tarifa registradas.';break;
        case 'update-zone':{
          const zones=await deliveryModel.adminZones();requireAdmin();const zone=zones.find(zone=>zone.id===command.id);
          if(!zone)throw new Error('No encuentro esa zona. Copia su identificador del panel.');
          const values=Object.fromEntries(['nombre','provincia','canton','tarifaCentavos','ivaCategoria','fundamentoIva','activa'].map(key=>[key,zone[key]??null]));
          await deliveryModel.saveZone({...values,...command.changes,esperadoVersion:zone.version},zone.id);message='Tarifa de zona actualizada; los pedidos anteriores conservan su tarifa.';break;
        }
        case 'assign-delivery':{
          const current=await findDelivery(item=>item.pedidoId===command.pedidoId);requireAdmin();
          await deliveryModel.assign({pedidoId:command.pedidoId,repartidorId:command.repartidorId,...(current?{esperadoVersion:current.version}:{})});message='Entrega asignada al repartidor indicado.';break;
        }
        case 'change-delivery-state':{
          const current=await findDelivery(item=>item.id===command.id);requireAdmin();if(!current)throw new Error('No encuentro esa entrega. Copia su identificador del panel.');
          await deliveryModel.changeState(command.id,command.estado,current.version);message=`Entrega actualizada a ${command.estado}.`;break;
        }
        default:return reply('No reconocí una orden administrativa admitida. Escribe ayuda para ver ejemplos.');
      }
      requireAdmin();await refresh();return reply(message);
    }finally{pending=false;}
  };
}

/** Mascota administrativa determinística: sólo procesa órdenes explícitas del panel. */
export function adminCompanionController({refresh=()=>{},navigate,openEditor}={}){
  if(document.body.dataset.page!=='admin'||!auth.isAdmin||document.querySelector('farmacia-admin-companion'))return null;
  const host=document.createElement('farmacia-admin-companion');
  const root=host.attachShadow({mode:'open'});
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('admin-companion.css',ASSETS).href;
  const template=document.createElement('template');
  template.innerHTML=`<aside class="companion"><section class="panel" id="panel" aria-labelledby="title" hidden><header><div><span class="eyebrow">ASISTENTE LOCAL DE LA FARMACIA</span><h2 id="title">Farmi te ayuda a gestionar</h2><p>Catálogo, pedidos y entregas</p></div><button class="close" id="close" type="button" aria-label="Cerrar asistente">×</button></header><div class="messages" id="messages" role="log" aria-label="Asistente de administración" aria-live="polite"></div><nav class="shortcuts" id="shortcuts" aria-label="Ayuda rápida de administración"></nav><form id="form"><label for="input" class="sr-only">Escribe una orden para el panel</label><input id="input" maxlength="3000" autocomplete="off" placeholder="Ej. actualiza precio de…" required><button type="submit" aria-label="Enviar orden">↑</button></form><p class="local-note">No uso servicios externos · los cambios se guardan con tu sesión de administrador</p></section><button class="launcher" id="launcher" type="button" aria-label="Abrir asistente administrativo" aria-expanded="false" aria-controls="panel"><img src="${new URL('art/farmi-base.png',ASSETS).href}" alt=""><span><span class="online" aria-hidden="true"></span> Ayuda administrativa</span><span aria-hidden="true">↗</span></button></aside>`;
  root.append(style,template.content.cloneNode(true));document.body.append(host);
  const find=selector=>root.querySelector(selector);
  function append(text,type='bot'){
    const item=document.createElement('div');item.className=`message ${type}`;
    const paragraph=document.createElement('p');paragraph.textContent=text;item.append(paragraph);
    find('#messages').append(item);find('#messages').scrollTop=find('#messages').scrollHeight;return item;
  }
  const quick=find('#shortcuts');
  function refreshQuickQuestions(){
    const section=new URLSearchParams(location.search).get('tabla')||'dashboard';
    const options=section==='productos'?[['Cambiar precio o stock','product'],['Aplicar descuento directo','product']]:section==='promociones'?[['Publicar promoción','promotion'],['Cambiar un producto','product']]:[['Actualizar un producto','product'],['Publicar una promoción','promotion'],['Proveedores y lotes','inventory'],['Secciones y entregas','navigation'],['Crear registros','records']];
    quick.replaceChildren();
    for(const [label,key] of options){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',()=>append(instructions[key]));quick.append(button);
    }
  }
  refreshQuickQuestions();
  document.getElementById('admin-table-choice')?.addEventListener('change',refreshQuickQuestions);
  const execute=createAdminCommandExecutor({refresh,navigate,openEditor});
  let pending=false;
  find('#form').addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!auth.isAdmin)return;
    const input=find('#input'),submit=find('#form [type=submit]'),text=input.value.trim();if(!text)return;
    input.value='';append(text,'user');pending=true;input.disabled=true;submit.disabled=true;
    const thinking=append('Farmi está revisando la orden…','thinking');
    try{const result=await execute(text);thinking.remove();append(result.text);}
    catch(error){thinking.remove();append(`No pude guardar el cambio: ${error.message}`,'error');}
    finally{pending=false;input.disabled=false;submit.disabled=false;if(!find('#panel').hidden)input.focus();}
  });
  function open(value){find('#panel').hidden=!value;find('#launcher').setAttribute('aria-expanded',String(value));if(value)find('#input').focus();else find('#launcher').focus();}
  find('#launcher').addEventListener('click',()=>open(find('#panel').hidden));
  find('#close').addEventListener('click',()=>open(false));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!find('#panel').hidden){event.preventDefault();open(false);}});
  append('¡Hola! Soy Farmi. Puedo gestionar productos, promociones, proveedores, lotes, inventario, pedidos y entregas con los permisos del panel. Proceso tus órdenes aquí mismo; no uso IA externa. Escribe ayuda para ver órdenes y campos requeridos. Si faltan datos reales, te los pediré o abriré su formulario.');
  events.addEventListener('session:expired',()=>host.remove(),{once:true});
  return Object.freeze({send:async text=>execute(text),open,remove:()=>host.remove()});
}
