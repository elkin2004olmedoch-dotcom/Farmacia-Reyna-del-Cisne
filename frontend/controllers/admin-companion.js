import {auth} from '../models/auth.js';
import {administration} from '../models/admin.js';
import {events} from '../models/events.js';
import {interpretAdminCommand} from './admin-command.mjs';

const ASSETS=new URL('../assets/mascotas/',import.meta.url);
const money=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(value));

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
    stockMinimo:Number(product.stockMinimo??5),pvpMaximo:product.pvpMaximo==null?null:Number(product.pvpMaximo),
    esperadoUpdatedAt:product.updatedAt,...changes,
  };
}

/** Mascota administrativa determinística: sólo procesa órdenes explícitas del panel. */
export function adminCompanionController({refresh=()=>{}}={}){
  if(document.body.dataset.page!=='admin'||!auth.isAdmin||document.querySelector('farmacia-admin-companion'))return null;
  const host=document.createElement('farmacia-admin-companion');
  const root=host.attachShadow({mode:'open'});
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('admin-companion.css',ASSETS).href;
  const template=document.createElement('template');
  template.innerHTML=`<aside class="companion"><section class="panel" id="panel" aria-labelledby="title" hidden><header><div><span class="eyebrow">ASISTENTE LOCAL DE LA FARMACIA</span><h2 id="title">Farmi te ayuda a gestionar</h2><p>Productos y promociones del catálogo</p></div><button class="close" id="close" type="button" aria-label="Cerrar asistente">×</button></header><div class="messages" id="messages" role="log" aria-label="Asistente de administración" aria-live="polite"></div><nav class="shortcuts" id="shortcuts" aria-label="Ayuda rápida de administración"></nav><form id="form"><label for="input" class="sr-only">Escribe una orden para el panel</label><input id="input" maxlength="240" autocomplete="off" placeholder="Ej. actualiza precio de…" required><button type="submit" aria-label="Enviar orden">↑</button></form><p class="local-note">No uso servicios externos · los cambios se guardan con tu sesión de administrador</p></section><button class="launcher" id="launcher" type="button" aria-label="Abrir asistente administrativo" aria-expanded="false" aria-controls="panel"><img src="${new URL('art/farmi-base.png',ASSETS).href}" alt=""><span><span class="online" aria-hidden="true"></span> Ayuda administrativa</span><span aria-hidden="true">↗</span></button></aside>`;
  root.append(style,template.content.cloneNode(true));document.body.append(host);
  const find=selector=>root.querySelector(selector);
  function append(text,type='bot'){
    const item=document.createElement('div');item.className=`message ${type}`;
    const paragraph=document.createElement('p');paragraph.textContent=text;item.append(paragraph);
    find('#messages').append(item);find('#messages').scrollTop=find('#messages').scrollHeight;return item;
  }
  const instructions={
    product:'Escribe el nombre exacto y qué cambia. Ejemplo: actualiza el precio de "Vitaminas diarias" a 13,50 y el stock a 24. También puedes indicar descuento directo de 10 %.',
    promotion:'Para publicar una promoción indica producto, porcentaje y fecha final Ecuador (AAAA-MM-DD). Ejemplo: publica promoción de 20 % para "Vitaminas diarias" hasta 2026-12-31 titulada "Fin de año".',
  };
  const quick=find('#shortcuts');
  function refreshQuickQuestions(){
    const section=new URLSearchParams(location.search).get('tabla')||'dashboard';
    const options=section==='productos'?[['Cambiar precio o stock','product'],['Aplicar descuento directo','product']]:section==='promociones'?[['Publicar promoción','promotion'],['Cambiar un producto','product']]:[['Actualizar un producto','product'],['Publicar una promoción','promotion']];
    quick.replaceChildren();
    for(const [label,key] of options){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',()=>append(instructions[key]));quick.append(button);
    }
  }
  refreshQuickQuestions();
  document.getElementById('admin-table-choice')?.addEventListener('change',refreshQuickQuestions);
  async function execute(text){
    if(!auth.isAdmin)throw new Error('Inicia sesión nuevamente como administrador.');
    const products=await administration.products();
    const command=interpretAdminCommand(text,products);
    if(command.type==='help')return {type:'reply',text:`Puedo cambiar precio, stock o descuento directo de un producto existente, y crear/publicar una promoción por producto. ${instructions.product} ${instructions.promotion}`};
    if(command.type==='off-topic'||command.type==='needs-details')return {type:'reply',text:command.message};
    if(command.type==='update-product'){
      if(!command.product.activo)return {type:'reply',text:'Ese producto está inactivo. Revísalo desde la tabla Productos antes de hacer cambios.'};
      await administration.saveProduct(productValues(command.product,command.changes),command.product.id);
      await refresh();
      const changes=Object.entries(command.changes).map(([key,value])=>key==='precio'?`precio ${money(value)}`:key==='stock'?`stock ${value}`:`descuento directo ${value} %`).join(' y ');
      return {type:'reply',text:`Producto actualizado: ${command.product.nombre}; ${changes}.`};
    }
    if(command.type==='create-promotion'){
      await administration.savePromotion(command.values);
      await refresh();
      return {type:'reply',text:`Promoción publicada: ${command.values.titulo}, ${command.values.descuentoPorcentaje} % para ${command.product.nombre}, hasta ${command.values.fin.slice(0,10)} (hora de Ecuador). Ya aparecerá en la tienda mientras esté vigente.`};
    }
    return {type:'reply',text:'No reconocí una orden administrativa admitida. Pulsa una ayuda rápida para ver ejemplos.'};
  }
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
  append('¡Hola! Soy Farmi, tu ayudante del panel. Puedo actualizar precio, stock o descuento directo, y publicar promociones para un producto. Mis órdenes se procesan aquí mismo; no uso IA externa. Pulsa una ayuda rápida para ver el formato.');
  events.addEventListener('session:expired',()=>host.remove(),{once:true});
  return Object.freeze({send:async text=>execute(text),open,remove:()=>host.remove()});
}
