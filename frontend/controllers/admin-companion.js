import {auth} from '../models/auth.js';
import {administration} from '../models/admin.js';
import {events} from '../models/events.js';
import {interpretAdminCommand,ecuadorCommandDay} from './admin-command.mjs';
import {deliveries} from '../models/deliveries.js';
import {companionControls,disableCompanionControls} from './companion-controls.js';
import '../models/pharmacy-policy.js';

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
export function createAdminCommandExecutor({model=administration,deliveryModel=deliveries,isAdmin=()=>auth.isAdmin,refresh=()=>{},navigate,openEditor,confirm=false}={}){
  let pending=false,proposal=null,operation='update';
  const requireAdmin=()=>{if(!isAdmin())throw new Error('Inicia sesión nuevamente como administrador.');};
  const reply=text=>({type:'reply',text});
  async function findDelivery(predicate){
    let page=1;
    while(true){const data=await deliveryModel.list(page++);requireAdmin();const found=data.items.find(predicate);if(found)return found;if(!data.items.length||(page-1)*data.pageSize>=data.total||data.items.length>=data.total)return null;}
  }
  return async text=>{
    requireAdmin();if(pending)throw new Error('Espera a que termine la orden anterior.');pending=true;
    try{
      const normalized=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(confirm && /^(no|no,? cancelar|cancelar|cancela)$/.test(normalized)){proposal=null;return reply('Cancelado. No se guardó ningún cambio.');}
      let command;
      if(confirm && /^(si|si,? confirmo|si,? confirmar|confirmar|confirmo)$/.test(normalized)){
        command=proposal;proposal=null;if(!command)return reply('No hay cambios pendientes de confirmar. Escribe una orden nueva.');
      }else{
      proposal=null;
      if(/^(?:(?:ver|abrir|abre|actualizar|actualiza|editar|edita)\s+)?(?:mi\s+)?perfil$/.test(normalized))return {text:'En tu perfil puedes actualizar tu nombre y teléfono.',actions:[{label:'Abrir mi perfil',href:'cuenta.html'}]};
      const recordChoice=normalized.match(/^seleccionar (pedido|zona) ([a-z0-9-]{1,80})$/);
      if(confirm && recordChoice){
        const [,entity,id]=recordChoice;
        if(entity==='pedido'){
          const order=await model.order(id);requireAdmin();
          const options={pendiente:['confirmado','cancelado'],confirmado:['preparado','cancelado'],preparado:['entregado','cancelado']}[order.estado]||[];
          if(!options.length)return reply('Ese pedido está cerrado y no admite otro estado.');
          return {text:`Pedido ${id}. Estado actual: ${order.estado}.`,fields:[{name:'state',label:'Nuevo estado del pedido',options:options.map(value=>({value,label:value}))}],submit:values=>`cambia pedido "${id}" a ${values.state}`};
        }
        const zones=await deliveryModel.adminZones();requireAdmin();const zone=zones.find(z=>z.id===id);if(!zone)return reply('La zona ya no está disponible.');
        return {text:`Zona ${zone.nombre}. Los pedidos anteriores conservarán su tarifa.`,fields:[{name:'fee',label:'Tarifa de envío en USD',type:'number',min:0,max:100000,step:.01,value:zone.tarifaCentavos==null?'':zone.tarifaCentavos/100}],submit:values=>`modifica zona "${id}": tarifaCentavos=${Math.round(Number(values.fee)*100)}`};
      }
      if(confirm && /^(actualizar pedidos|actualizar zonas)$/.test(normalized)){
        const zones=normalized.endsWith('zonas');let items=[];
        if(zones)items=await deliveryModel.adminZones();
        else{let page=1,total=Infinity;while(items.length<total){const data=await model.table('pedidos',page++);requireAdmin();items.push(...data.items);total=data.total;if(!data.items.length)break;}}
        requireAdmin();if(!items.length)return reply('No hay registros disponibles en esa sección.');
        return {text:`Selecciona ${zones?'una zona':'un pedido'} para actualizar.`,fields:[{name:'record',label:zones?'Zonas de cobertura':'Pedidos registrados',options:items.map(item=>({value:item.id,label:zones?item.nombre:`${item.id} · ${item.nombre} · ${item.estado}`}))}],submit:values=>`seleccionar ${zones?'zona':'pedido'} ${values.record}`};
      }
      const choose=normalized.match(/^seleccionar producto ([a-z0-9-]{1,80})$/);
      if(confirm && choose){
        const products=await model.products();requireAdmin();const product=products.find(p=>p.id===choose[1]&&p.activo);
        if(!product)return reply('Ese producto ya no está disponible. Solicita la lista de nuevo.');
        return {type:'form',text:`${product.nombre}. Completa los cambios y revisa antes de confirmar.`,fields:operation==='promotion'?[{name:'percentage',label:'Descuento (%)',type:'number',min:1,max:85,step:1},{name:'until',label:'Válida hasta (Ecuador)',type:'date',min:ecuadorCommandDay(Date.now())}]:[{name:'price',label:'Precio en USD',type:'number',min:0,max:100000,step:.01,value:product.precio},{name:'stock',label:'Stock',type:'number',min:0,max:100000,step:1,value:product.stock}],submit:values=>operation==='promotion'?`Publica promoción ${values.percentage}% para "id:${product.id}" hasta ${values.until}`:`modifica producto "id:${product.id}": precio=${values.price}; stock=${values.stock}`};
      }
      if(confirm && /^(actualizar|actualiza|modificar|modifica|cambiar|cambia)(?: algo)?$/.test(normalized))return {type:'choice',text:'¿Qué quieres gestionar?',actions:[{label:'Productos: precio y stock',command:'actualizar productos'},{label:'Poner en promoción',command:'poner en promocion'},{label:'Pedidos',command:'actualizar pedidos'},{label:'Zonas y tarifas',command:'actualizar zonas'},{label:'Proveedores',command:'abre proveedores'},{label:'Lotes',command:'abre lotes'}]};
      if(confirm && (/^(actualiz|modific|cambi).*(productos?|precios?|stock)$/.test(normalized)||/^(?:poner|pon|publicar|publica|crear|crea)(?: una)?(?: en)? promo(?:cion(?:es)?)?$/.test(normalized))){
        operation=/promo/.test(normalized)?'promotion':'update';const products=(await model.products()).filter(p=>p.activo && (operation!=='promotion'||globalThis.Farmacia?.pharmacyPolicy?.allowsPromotion(p)!==false));requireAdmin();
        return products.length?{type:'selection',text:`Hay ${products.length} productos. Selecciona uno para ${operation==='promotion'?'ponerlo en promoción':'actualizarlo'}.`,fields:[{name:'product',label:'Todos los productos disponibles',options:products.map(p=>({value:p.id,label:`${p.nombre} · $${Number(p.precio).toFixed(2)} · stock ${p.stock}`}))}],submit:values=>'seleccionar producto '+values.product}:reply('No hay productos disponibles para esa acción.');
      }
      command=interpretAdminCommand(text);
      if(command.type==='needs-products'){const products=await model.products();requireAdmin();command=interpretAdminCommand(text,products);}
      if(confirm && !['help','off-topic','needs-details','navigate','open-editor'].includes(command.type)){
        if(command.type==='update-zone'){command.zone=(await deliveryModel.adminZones()).find(zone=>zone.id===command.id);requireAdmin();if(!command.zone)return reply('No encuentro esa zona. Solicita la lista de nuevo.');}
        if(command.type==='change-order-state'){command.order=await model.order(command.id);requireAdmin();}
        proposal=command;
        const details=command.changes||command.values||{estado:command.estado,pedidoId:command.pedidoId,repartidorId:command.repartidorId};
        const labels={precio:'Precio (USD)',stock:'Stock',tarifaCentavos:'Tarifa de envío (centavos)',descuentoPorcentaje:'Descuento (%)',titulo:'Título',descripcion:'Descripción',fin:'Válida hasta (Ecuador)',estado:'Nuevo estado'};
        const before=command.product?`Precio actual: USD ${Number(command.product.precio).toFixed(2)} · Stock actual: ${command.product.stock}\n`:command.zone?`Tarifa actual: ${command.zone.tarifaCentavos==null?'Pendiente':'USD '+(command.zone.tarifaCentavos/100).toFixed(2)}\n`:'';
        const changes=Object.entries(details).filter(([key,value])=>value!==undefined&&value!==null&&!['productoId','orden','vistaPrevia','imagen','alt'].includes(key)).map(([key,value])=>`${labels[key]||key}: ${key==='fin'?ecuadorCommandDay(value):value}`).join('\n');
        return {type:'confirmation',text:`Revisa la orden: ${command.product?.nombre||command.id||command.type}\n${before}${changes}\n¿Confirmas guardar este cambio?`,actions:[{label:'Sí, confirmar',command:'confirmar'},{label:'No, cancelar',command:'cancelar'}]};
      }
      }
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
          const order=command.order||await model.order(command.id);requireAdmin();
          if(!order?.updatedAt)throw new Error('No se pudo consultar la versión actual del pedido.');
          await model.changeOrderState(command.id,command.estado,order.updatedAt);message=`Pedido actualizado a ${command.estado}.`;break;
        }
        case 'create-zone':await deliveryModel.saveZone({...command.values,fundamentoIva:command.values.fundamentoIva??null});message='Zona y tarifa registradas.';break;
        case 'update-zone':{
          const zone=command.zone||(await deliveryModel.adminZones()).find(zone=>zone.id===command.id);requireAdmin();
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
      requireAdmin();try{await refresh();}catch{return reply(message+' El cambio se guardó, pero no se pudo refrescar el panel. Actualiza la página para consultarlo.');}return reply(message);
    }finally{pending=false;}
  };
}

/** Mascota administrativa determinística: sólo procesa órdenes explícitas del panel. */
export function adminCompanionController({refresh=()=>{},navigate,openEditor}={}){
  if(document.body.dataset.page!=='admin'||!auth.isAdmin||document.querySelector('farmacia-admin-companion'))return null;
  const host=document.createElement('farmacia-admin-companion');
  const root=host.attachShadow({mode:'open'});
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('admin-companion.css',ASSETS).href;
  const conversationStyle=document.createElement('link');conversationStyle.rel='stylesheet';conversationStyle.href=new URL('conversation.css',ASSETS).href;
  const template=document.createElement('template');
  template.innerHTML=`<aside class="companion"><section class="panel" id="panel" aria-labelledby="title" hidden><header><div><span class="eyebrow">ASISTENTE LOCAL DE LA FARMACIA</span><h2 id="title">Farmi te ayuda a gestionar</h2><p>Catálogo, pedidos y entregas</p></div><button class="close" id="close" type="button" aria-label="Cerrar asistente">×</button></header><div class="messages" id="messages" role="log" aria-label="Asistente de administración" aria-live="polite"></div><nav class="shortcuts" id="shortcuts" aria-label="Ayuda rápida de administración"></nav><form id="form"><label for="input" class="sr-only">Escribe una orden para el panel</label><input id="input" maxlength="3000" autocomplete="off" placeholder="Ej. actualiza precio de…" required><button type="submit" aria-label="Enviar orden">↑</button></form><p class="local-note">No uso servicios externos · los cambios se guardan con tu sesión de administrador</p></section><button class="launcher" id="launcher" type="button" aria-label="Abrir asistente administrativo" aria-expanded="false" aria-controls="panel"><img src="${new URL('art/farmi-base.png',ASSETS).href}" alt=""><span><span class="online" aria-hidden="true"></span> Ayuda administrativa</span><span aria-hidden="true">↗</span></button></aside>`;
  root.append(style,conversationStyle,template.content.cloneNode(true));document.body.append(host);
  const find=selector=>root.querySelector(selector);
  const motionButton=document.createElement('button');motionButton.type='button';motionButton.id='motion-toggle';motionButton.className='motion-toggle';find('#launcher').after(motionButton);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const savedMotion=()=>{try{return localStorage.getItem('farmacia-motion');}catch{return null;}};
  let motionPaused=savedMotion()==='paused'||savedMotion()===null&&reducedMotion.matches;
  function applyMotion(){host.dataset.motion=motionPaused?'paused':'active';motionButton.textContent=motionPaused?'▶':'Ⅱ';motionButton.setAttribute('aria-label',motionPaused?'Activar movimiento de Farmi':'Pausar movimiento de Farmi');motionButton.setAttribute('aria-pressed',String(motionPaused));motionButton.title=motionPaused?'Movimiento pausado; pulsa para activarlo.':'Pausar movimiento';}
  motionButton.addEventListener('click',()=>{motionPaused=!motionPaused;try{localStorage.setItem('farmacia-motion',motionPaused?'paused':'active');}catch{}applyMotion();});
  reducedMotion.addEventListener('change',()=>{if(savedMotion()===null){motionPaused=reducedMotion.matches;applyMotion();}});applyMotion();
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
      button.addEventListener('click',()=>key==='product'||key==='promotion'?void send(key==='product'?'actualizar productos':'poner en promocion'):append(instructions[key]));quick.append(button);
    }
  }
  refreshQuickQuestions();
  document.getElementById('admin-table-choice')?.addEventListener('change',refreshQuickQuestions);
  const execute=createAdminCommandExecutor({refresh,navigate,openEditor,confirm:true});
  let pending=false;
  async function send(text,display){
    if(pending||!auth.isAdmin)return;
    const input=find('#input'),submit=find('#form [type=submit]');text=String(text).trim();if(!text)return;
    disableCompanionControls(root);
    input.value='';append(display||text,'user');pending=true;input.disabled=true;submit.disabled=true;
    const thinking=append('Farmi está revisando la orden…','thinking');
    try{const result=await execute(text);thinking.remove();companionControls(append(result.text),result,send);}
    catch(error){thinking.remove();append(`No pude guardar el cambio: ${error.message}`,'error');}
    finally{pending=false;input.disabled=false;submit.disabled=false;if(!find('#panel').hidden)input.focus();}
  }
  find('#form').addEventListener('submit',event=>{event.preventDefault();void send(find('#input').value);});
  function open(value){find('#panel').hidden=!value;find('#launcher').setAttribute('aria-expanded',String(value));if(value)find('#input').focus();else find('#launcher').focus();}
  find('#launcher').addEventListener('click',()=>open(find('#panel').hidden));
  find('#close').addEventListener('click',()=>open(false));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!find('#panel').hidden){event.preventDefault();open(false);}});
  append('¡Hola! Soy Farmi. Puedo gestionar productos, promociones, proveedores, lotes, inventario, pedidos y entregas con los permisos del panel. Proceso tus órdenes aquí mismo; no uso IA externa. Escribe ayuda para ver órdenes y campos requeridos. Si faltan datos reales, te los pediré o abriré su formulario.');
  events.addEventListener('session:expired',()=>host.remove(),{once:true});
  return Object.freeze({send,open,remove:()=>host.remove()});
}
