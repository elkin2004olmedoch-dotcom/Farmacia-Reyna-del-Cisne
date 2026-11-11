import {productImageUrl} from '../config.js';

const recordId=/^[a-z0-9][a-z0-9-]{0,79}$/;
const tables=['productos','promociones','pedidos','proveedores','lotes','movimientos','zonas','entregas'];
const money=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(value);
const price=value=>(typeof value==='number'||typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value))&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
/** Conversation data may select only these internal destinations and exact parameters. */
export function safeCompanionHref(href){
  if(typeof href!=='string')return null;
  if(['cuenta.html','pedidos.html','checkout.html','catalogo.html'].includes(href))return href;
  if(/[\\#\s]/.test(href))return null;
  const match=href.match(/^(producto|seguimiento|admin)\.html\?(.+)$/);if(!match)return null;
  const params=new URLSearchParams(match[2]),keys=[...params.keys()];
  if(match[1]==='admin')return keys.length===2&&keys.includes('tabla')&&keys.includes('registro')&&tables.includes(params.get('tabla'))&&recordId.test(params.get('registro')||'')?'admin.html?tabla='+params.get('tabla')+'&registro='+params.get('registro'):null;
  const key=match[1]==='producto'?'id':'pedido',id=params.get(key);
  return keys.length===1&&keys[0]===key&&recordId.test(id||'')?match[1]+'.html?'+key+'='+id:null;
}
/** Card interaction helper: text nodes, trusted local paths and image recovery. */
export function appendCompanionCards(target,summary,doc=document){
  if(!summary||!['products','cart','orders'].includes(summary.kind)||!Array.isArray(summary.items))return;
  const group=doc.createElement('div');group.className='companion-cards';
  const text=(tag,value)=>{const node=doc.createElement(tag);node.textContent=String(value??'');return node;};
  function productCard(product,historical=false){
    if(!product||!recordId.test(product.id||'')||typeof product.nombre!=='string')return null;
    const card=doc.createElement('article');card.className='companion-card';
    const image=doc.createElement('img');image.src=productImageUrl(product.imagen);image.alt=product.alt||product.nombre;image.width=64;image.height=64;image.loading='lazy';image.decoding='async';
    image.addEventListener('error',()=>{image.src=productImageUrl(null);},{once:true});
    const copy=doc.createElement('div');copy.className='companion-card-copy';
    const link=text('a',product.nombre);link.href='producto.html?id='+product.id;copy.append(link);
    if(product.presentacion)copy.append(text('p',product.presentacion));
    const amount=price(product.precio);copy.append(text('p',!historical&&product.soloConsulta?'Consultar precio y disponibilidad':amount===null?'Precio por confirmar':money(amount)+(historical?' al comprar':' por unidad')));
    if(product.cantidad)copy.append(text('p','Cantidad: '+product.cantidad));
    if(!historical){if(!product.soloConsulta)copy.append(text('p',product.activo===false?'Ya no está disponible':!Number.isInteger(product.stock)?'Disponibilidad por confirmar':product.stock===0?'Agotado':product.cantidad>product.stock?'Stock insuficiente: '+product.stock+' unidades':product.stock+' unidades disponibles'));if(product.restricted)copy.append(text('p','Requiere atención farmacéutica'));}
    card.append(image,copy);return card;
  }
  for(const item of summary.items){
    if(summary.kind!=='orders'){const card=productCard(item);if(card)group.append(card);continue;}
    if(!recordId.test(item?.id||''))continue;
    const card=doc.createElement('article');card.className='companion-order';
    card.append(text('strong','Pedido '+item.id.slice(0,8)),text('p','Estado: '+({pendiente:'Pendiente',confirmado:'Confirmado',preparado:'Preparado',entregado:'Entregado',cancelado:'Cancelado'}[item.estado]||'Por consultar')));
    for(const product of item.productos||[]){const line=productCard(product,true);if(line)card.append(line);}
    if(item.remaining>0)card.append(text('p',item.remaining+' productos más en Mis pedidos.'));
    const total=price(item.total);if(total!==null)card.append(text('p','Total registrado: '+money(total)));
    const link=text('a','Seguir mi pedido');link.href='seguimiento.html?pedido='+item.id;card.append(link);group.append(card);
  }
  if(summary.kind==='cart')group.append(text('p',Number.isSafeInteger(summary.subtotalCentavos)&&summary.subtotalCentavos>=0?'Subtotal de productos: '+money(summary.subtotalCentavos/100):'Subtotal pendiente: revisa los productos sin precio disponible.'));
  target.append(group);
}
