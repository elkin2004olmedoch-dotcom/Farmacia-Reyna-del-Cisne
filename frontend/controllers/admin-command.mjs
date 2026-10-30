function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();}
const needsDetails=message=>({type:'needs-details',message});
const sections={dashboard:'dashboard',resumen:'dashboard',productos:'productos',producto:'productos',promociones:'promociones',promocion:'promociones',proveedores:'proveedores',proveedor:'proveedores',lotes:'lotes',lote:'lotes',inventario:'movimientos',movimientos:'movimientos',pedidos:'pedidos',usuarios:'usuarios',iva:'fiscal',fiscal:'fiscal',facturacion:'facturacion',entregas:'entregas',zonas:'entregas',repartidores:'entregas'};
const editable=new Set(['productos','promociones','proveedores','lotes','movimientos']);
const idPattern=/^[a-z0-9][a-z0-9-]{0,79}$/;
export const ecuadorCommandDay=value=>new Date(new Date(value).getTime()-5*3600000).toISOString().slice(0,10);
function realDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function findProduct(text,products){
  if(!products)return {type:'needs-products'};
  const quoted=[...String(text).matchAll(/["“]([^"”]+)["”]/g)].map(match=>normalize(match[1]));
  const value=normalize(text);
  const matches=products.filter(product=>product?.nombre&&(quoted.length?quoted.includes(normalize(product.nombre)):new RegExp(`(?:^|[^\\p{L}\\p{N}])${normalize(product.nombre).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^\\p{L}\\p{N}])`,'u').test(value)));
  if(matches.length!==1)return needsDetails(matches.length?'Veo más de un producto en la orden. Escribe el nombre exacto de uno solo.':'No encuentro ese nombre exacto en el catálogo. Copia el nombre tal como aparece en Productos.');
  return {product:matches[0]};
}
const productFields={nombre:'text',precio:'money',stock:'integer',categoria:['bienestar','cuidado','bebe'],descripcion:'text',imagen:'text',alt:'text',descuentoPorcentaje:'percent',ivaCategoria:['general','cero'],fundamentoIva:'text',tipoProducto:['cuidado','medicamento','insumo','suplemento'],codigoInterno:'text',codigoBarras:'text',laboratorio:'text',principioActivo:'text',concentracion:'text',presentacion:'text',registroSanitario:'text',requiereReceta:'boolean',controlado:'boolean',biologico:'boolean',cadenaFrio:'boolean',stockMinimo:'integer',pvpMaximo:'money'};
const schemas={producto:productFields,proveedor:{nombre:'text',ruc:'text',email:'text',telefono:'text',direccion:'text',activo:'boolean'},lote:{producto:'text',numero:'text',vencimiento:'day',cantidad:'positive',costoUnitario:'money',proveedorId:'id'},inventario:{producto:'text',tipo:['entrada','salida'],cantidad:'positive',motivo:'text',loteId:'id'},zona:{nombre:'text',provincia:'text',canton:'text',tarifaCentavos:'integer',ivaCategoria:['general','cero'],fundamentoIva:'text',activa:'boolean'}};
// Grammar: verbo entidad: campo=valor; campo="texto". Only these fields exist.
function readFields(source,schema){
  const values={};let rest=source.trim();
  while(rest){
    const match=rest.match(/^([a-zA-Z]+)\s*=\s*(?:"([^"\r\n]*)"|“([^”\r\n]*)”|([^;"“”\r\n]+))\s*(?:;\s*|$)/);
    if(!match)return {error:'Usa campo=valor separados por punto y coma; encierra los textos entre comillas.'};
    const key=Object.keys(schema).find(key=>normalize(key)===normalize(match[1]));
    if(!key||Object.hasOwn(values,key))return {error:'Hay campos desconocidos o repetidos. Consulta ayuda para ver los campos admitidos.'};
    let value=(match[2]??match[3]??match[4]).trim();const rule=schema[key];
    if(key==='tarifaCentavos'&&value==='null')value=null;
    else if(Array.isArray(rule)){value=normalize(value);if(!rule.includes(value))return {error:`${key}: usa ${rule.join(' o ')}.`};}
    else if(['integer','positive','money','percent'].includes(rule)){
      if(!(rule==='money'?/^\d+(?:[.,]\d{1,2})?$/:/^\d+$/).test(value))return {error:`${key}: escribe un número válido${rule==='money'?' con hasta dos decimales':' entero'}.`};
      value=Number(value.replace(',','.'));if(value>(rule==='percent'?85:key==='tarifaCentavos'?10000000:100000)||value<(rule==='positive'?1:0))return {error:`${key}: valor fuera del rango permitido.`};
    }else if(rule==='boolean'){if(!['true','false'].includes(value))return {error:`${key}: usa true o false.`};value=value==='true';}
    else if(rule==='id'&&!idPattern.test(value))return {error:`${key}: copia el identificador exacto.`};
    else if(rule==='day'&&(!realDay(value)||value<ecuadorCommandDay(Date.now())))return {error:`${key}: usa una fecha real de hoy o futura (AAAA-MM-DD, Ecuador).`};
    if(typeof value==='string'&&(!value||value.length>500||/[<>\x00-\x1f]/.test(value)))return {error:`${key}: texto vacío, demasiado largo o con caracteres no permitidos.`};
    values[key]=value;rest=rest.slice(match[0].length);
  }
  return {values};
}
function formCommand(section,values,missing,record){return {type:'open-editor',section,values,...(record?{record}:{}),message:`Completa ${missing.join(', ')} en el formulario. No inventaré datos sanitarios ni comerciales.`};}
function structuredCommand(original,products){
  const match=original.match(/^(crea|crear|registra|registrar|ajusta|ajustar|modifica|modificar|actualiza|actualizar)\s+(producto|proveedor|lote|inventario|zona)(?:\s+["“]([^"”]+)["”])?\s*:\s*([\s\S]*)$/i);
  if(!match)return null;
  const entity=normalize(match[2]),parsed=readFields(match[4],schemas[entity]);if(parsed.error)return needsDetails(parsed.error);
  const values=parsed.values,updating=/^(modifica|modificar|actualiza|actualizar)$/i.test(match[1]);
  if(updating){
    if(entity==='zona')return match[3]&&idPattern.test(match[3])?{type:'update-zone',id:match[3],changes:values}:needsDetails('Copia el identificador exacto de la zona entre comillas.');
    if(entity!=='producto')return needsDetails('Abre el formulario del registro para modificarlo con sus datos actuales.');
    if(!match[3])return needsDetails('Indica el nombre exacto del producto entre comillas antes de los dos puntos.');
    const found=findProduct(`"${match[3]}"`,products);if(!found.product)return found;
    if(!Object.keys(values).length)return formCommand('productos',{},['los cambios'],found.product);
    return {type:'update-product',product:found.product,changes:values};
  }
  const required={producto:['nombre','precio','stock','categoria','tipoProducto','descripcion','imagen','alt','ivaCategoria'],proveedor:['nombre','ruc','email','telefono','direccion','activo'],lote:['producto','numero','vencimiento','cantidad','costoUnitario'],inventario:['producto','tipo','cantidad','motivo'],zona:['nombre','provincia','canton','tarifaCentavos','ivaCategoria','activa']}[entity];
  if(entity==='producto'&&values.tipoProducto==='medicamento')required.push('pvpMaximo','laboratorio','presentacion','registroSanitario','requiereReceta','controlado','biologico','cadenaFrio');
  if(['producto','zona'].includes(entity)&&values.ivaCategoria==='cero')required.push('fundamentoIva');
  const section={producto:'productos',proveedor:'proveedores',lote:'lotes',inventario:'movimientos',zona:'entregas'}[entity],missing=required.filter(key=>values[key]===undefined);
  if(['lote','inventario'].includes(entity)&&values.producto!==undefined){
    const found=findProduct(`"${values.producto}"`,products);if(!found.product)return found;
    values.productoId=found.product.id;delete values.producto;
  }
  if(missing.length)return formCommand(section,values,missing);
  if(entity==='producto'&&values.pvpMaximo!==undefined&&values.precio>values.pvpMaximo)return needsDetails('El precio no puede superar el PVP máximo impreso.');
  if(['lote','inventario'].includes(entity)){
    if(entity==='lote')values.proveedorId??=null;else values.loteId??=null;
  }
  return {type:{producto:'create-product',proveedor:'create-supplier',lote:'create-lot',inventario:'create-movement',zona:'create-zone'}[entity],values};
}
/** Closed local grammar. No SQL, eval, external AI, or arbitrary method dispatch. */
export function interpretAdminCommand(text,products){
  const original=String(text??'').trim(),value=normalize(original);
  if(!value)return needsDetails('Escribe qué sección, producto o promoción quieres gestionar.');
  if(original.length>3000||/[<>\x00-\x1f]/.test(original))return needsDetails('La orden contiene caracteres no permitidos o es demasiado larga.');
  if(/^(?:ayuda|ejemplos?|como funciona|que puedes hacer|que comandos)[?.!]*$/.test(value))return {type:'help'};
  const navigation=value.match(/^(?:abre|abrir|ver|muestra|ir a)\s+(?:(?:el|la|los|las)\s+)?(?:(formulario)(?:\s+de)?\s+)?([a-z]+)[.!]?$/);
  if(navigation&&sections[navigation[2]]){const section=sections[navigation[2]];return navigation[1]&&editable.has(section)?{type:'open-editor',section,values:{}}:{type:'navigate',section};}
  const structured=structuredCommand(original,products);if(structured)return structured;
  const assign=original.match(/^asigna\s+pedido\s+"([a-z0-9][a-z0-9-]{0,79})"\s+a\s+repartidor\s+"([a-z0-9][a-z0-9-]{0,79})"$/i);
  if(assign)return {type:'assign-delivery',pedidoId:assign[1],repartidorId:assign[2]};
  const delivery=original.match(/^cambia\s+entrega\s+"([a-z0-9][a-z0-9-]{0,79})"\s+a\s+(\w+)$/i);
  if(delivery)return ['en_camino','en_destino','entregada','cancelada'].includes(normalize(delivery[2]))?{type:'change-delivery-state',id:delivery[1],estado:normalize(delivery[2])}:needsDetails('Estados permitidos de entrega: en_camino, en_destino, entregada o cancelada. La API verifica la transición.');
  const simpleCreate=value.match(/^(?:crea|crear|registra|registrar)\s+(?:un |una )?(producto|proveedor|lote|zona|promocion)$/);
  if(simpleCreate)return {type:'open-editor',section:sections[simpleCreate[1]]||'entregas',values:{},message:'Completa los datos reales del registro en el formulario.'};
  const state=original.match(/^(?:cambia|actualiza)\s+pedido\s+["“]([a-z0-9][a-z0-9-]{0,79})["”]\s+a\s+(\w+)\s*$/i);
  if(state)return ['confirmado','preparado','entregado','cancelado'].includes(normalize(state[2]))?{type:'change-order-state',id:state[1],estado:normalize(state[2])}:needsDetails('Estados permitidos del pedido: confirmado, preparado, entregado o cancelado. La API verifica la transición.');
  if(/^(?:desactiva|desactivar)\s+producto\b/.test(value)){
    const target=original.replace(/^\S+\s+producto\s+/i,''),found=findProduct(target,products);if(!found.product)return found;
    if(normalize(target.replace(/["“”]/g,''))!==normalize(found.product.nombre))return needsDetails('Indica solo un producto para desactivar.');
    return {type:'deactivate-product',product:found.product};
  }
  if(/^(?:pon|poner|publica|publicar|activa|activar|crea|crear|sube|subir)\b/.test(value)&&/\b(?:promocion|promo|descuento|oferta)\b/.test(value)){
    const found=findProduct(original,products);if(!found.product)return found;
    const percentageMatch=value.match(/(?:^|\s)(\d{1,3})\s*%/),until=value.match(/\bhasta(?:\s+el)?\s+(\d{4}-\d{2}-\d{2})\b/);
    if(!percentageMatch||Number(percentageMatch[1])<1||Number(percentageMatch[1])>85)return needsDetails('Dime el porcentaje de descuento entero, entre 1 % y 85 %.');
    if(!until||!realDay(until[1])||until[1]<ecuadorCommandDay(Date.now()))return needsDetails('Dime una fecha final real de hoy o futura en formato AAAA-MM-DD (hora de Ecuador).');
    const title=original.match(/\b(?:titulada?|llamada?)\s+["“]([^"”]{2,120})["”]\s*$/i);
    let remainder=normalize(original.replace(title?.[0]||'','')).replace(normalize(found.product.nombre),'').replace(until[0],'').replace(percentageMatch[0],'');
    remainder=remainder.replace(/["“”]/g,'').replace(/\b(?:pon|poner|publica|publicar|activa|activar|crea|crear|sube|subir|una|la|promocion|promo|descuento|oferta|de|del|para|en|el|producto)\b/g,'').trim();
    if(remainder)return needsDetails('Usa una sola orden de promoción: producto, porcentaje entero, fecha y título opcional.');
    const percentage=Number(percentageMatch[1]),product=found.product,titulo=title?.[1].trim()||`Promoción ${percentage}% · ${product.nombre}`;
    return {type:'create-promotion',product,values:{titulo,etiqueta:`-${percentage}%`,descripcion:`Descuento del ${percentage}% en ${product.nombre}. Válido hasta ${until[1]} (hora de Ecuador).`,productoId:product.id,descuentoPorcentaje:percentage,orden:0,inicio:null,fin:new Date(`${until[1]}T23:59:59.999-05:00`).toISOString(),activa:true,vistaPrevia:false,imagen:null,alt:null}};
  }
  if(/^(?:actualiza|actualizar|cambia|cambiar|modifica|modificar|ajusta|ajustar)\b/.test(value)&&/\b(?:producto|precio|stock|existencias|descuento)\b/.test(value)){
    const found=findProduct(original,products);if(!found.product)return found;
    let rest=normalize(original).replace(normalize(found.product.nombre),'');const changes={};let invalid=false;
    rest=rest.replace(/\b(precio|stock|existencias|descuento(?:\s+directo)?)\s*(?:de\s*)?["“”]*\s*(?:a|en|de)?\s*(usd\s*|\$\s*)?(-?\d+(?:[.,]\d+)?)\s*(%)?/g,(match,field,currency,amount,percent)=>{
      const key=field==='precio'?'precio':field.startsWith('descuento')?'descuentoPorcentaje':'stock',number=Number(amount.replace(',','.'));
      if(Object.hasOwn(changes,key)||number<0||number>(key==='descuentoPorcentaje'?85:100000)||(key!=='precio'&&!Number.isInteger(number))||(key==='precio'&&!/^\d+(?:[.,]\d{1,2})?$/.test(amount))||(key==='descuentoPorcentaje'&&!percent)||(key!=='descuentoPorcentaje'&&percent)||(key!=='precio'&&currency))invalid=true;
      changes[key]=number;return '';
    });
    rest=rest.replace(/["“”]/g,'').replace(/\b(?:actualiza|actualizar|cambia|cambiar|modifica|modificar|ajusta|ajustar|el|la|de|del|producto|y)\b/g,'').trim();
    if(invalid||rest||!Object.keys(changes).length)return needsDetails('Indica solo cambios válidos: precio a 4,50; stock a 20; o descuento a 10 % (0–85 %).');
    return {type:'update-product',product:found.product,changes};
  }
  return {type:'off-topic',message:'Puedo gestionar productos, promociones, proveedores, lotes, inventario y estados de pedido, y abrir secciones del panel. Escribe ayuda para ver el formato. Roles, firmas, pagos y emisiones se gestionan con sus controles específicos.'};
}
