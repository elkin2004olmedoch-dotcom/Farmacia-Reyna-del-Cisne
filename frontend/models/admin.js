import {request} from './api.js';
import './ecuador.js';
export const administration={
  summary:()=>request('/admin/resumen'),
  table:(name,page=1)=>request(['proveedores','lotes','movimientos'].includes(name)?`/admin/${name==='movimientos'?'inventario/movimientos':name}?page=${page}&pageSize=20`:`/admin/tablas?tabla=${encodeURIComponent(name)}&page=${page}&pageSize=20`),
  async products(){const items=[];let page=1,total=Infinity;while(items.length<total){const data=await request(`/admin/tablas?tabla=productos&page=${page++}&pageSize=100`);items.push(...data.items);total=data.total;if(!data.items.length)break;}return items;},
  saveProduct:(values,id)=>request('/productos'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removeProduct:id=>request('/productos/'+encodeURIComponent(id),{method:'DELETE'}),
  savePromotion:(values,id)=>request('/promociones'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removePromotion:id=>request('/promociones/'+encodeURIComponent(id),{method:'DELETE'}),
  fiscal:()=>request('/admin/configuracion/fiscal'),
  saveFiscal:values=>request('/admin/configuracion/fiscal',{method:'POST',body:values}),
  suppliers:()=>allPages('/admin/proveedores'),
  lots:productoId=>allPages('/admin/lotes', '&productoId='+encodeURIComponent(productoId)),
  saveSupplier:(values,id)=>request('/admin/proveedores'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  saveLot:values=>request('/admin/lotes',{method:'POST',body:values}),
  saveMovement:values=>request('/admin/inventario/ajustes',{method:'POST',body:values}),
  changeOrderState:(id,estado,esperadoUpdatedAt)=>request('/pedidos/'+encodeURIComponent(id)+'/estado',{method:'PUT',body:{estado,esperadoUpdatedAt}}),
  async uploadImage(file,signal){const bytes=new Uint8Array(await file.arrayBuffer());const chunks=[];for(let offset=0;offset<bytes.length;offset+=8192)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+8192)));return request('/admin/imagenes',{method:'POST',body:{archivo:btoa(chunks.join('')),nombreOriginal:file.name},signal});},
};

async function allPages(path,extra=''){
  const items=[];let page=1,total=Infinity;
  while(items.length<total){const data=await request(`${path}?page=${page++}&pageSize=100${extra}`);items.push(...data.items);total=data.total;if(!data.items.length)break;}
  return {items,total,page:1,pageSize:items.length};
}

const V=globalThis.Farmacia.validation;
export const ecuadorToday=()=>new Date(Date.now()-5*3600000).toISOString().slice(0,10);
export const ecuadorDateTime=value=>value?new Date(value+'-05:00').toISOString():null;
export function adminFormIssues(form) {
  const values=Object.fromEntries(new FormData(form));const issues={};
  for(const field of form.querySelectorAll('input[name],select[name],textarea[name]')){
    if(field.disabled || ['file','hidden','checkbox'].includes(field.type))continue;
    const value=String(values[field.name] ?? '').trim();
    if(field.required && !value)issues[field.name]='Completa este campo.';
    else if(value && field.maxLength>0 && value.length>field.maxLength)issues[field.name]=`Usa hasta ${field.maxLength} caracteres.`;
    else if(value && field.minLength>0 && value.length<field.minLength)issues[field.name]=`Usa al menos ${field.minLength} caracteres.`;
    else if(value && /[<>\x00-\x1f]/.test(value))issues[field.name]='No incluyas etiquetas ni caracteres de control.';
    if(field.type==='number' && value){const n=Number(value),minimum=field.min===''?-Infinity:Number(field.min),maximum=field.max===''?Infinity:Number(field.max);if(!Number.isFinite(n) || n<minimum || n>maximum)issues[field.name]=`Escribe un valor entre ${minimum} y ${maximum}.`;else if(field.step==='1' && !Number.isInteger(n))issues[field.name]='Escribe un número entero.';else if(field.step==='0.01' && Math.abs(n*100-Math.round(n*100))>0.000001)issues[field.name]='Usa como máximo dos decimales.';}
  }
  if(form.id==='product-form'){
    if(!values.imagen)issues.imagen='Selecciona una imagen para el producto.';
    if(values.codigoBarras){const code=values.codigoBarras;const sum=[...code.slice(0,-1)].reverse().reduce((n,d,i)=>n+Number(d)*(i%2?1:3),0);if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^(\d)\1+$/.test(code) || (10-sum%10)%10!==Number(code.at(-1)))issues.codigoBarras='Usa un código GTIN de 8, 12, 13 o 14 dígitos con verificador correcto.';}
    if(values.codigoInterno && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(values.codigoInterno))issues.codigoInterno='Usa de 2 a 40 letras, números, puntos o guiones; inicia con una letra o número.';
    if(values.ivaCategoria==='cero' && String(values.fundamentoIva || '').trim().length<8)issues.fundamentoIva='Indica el fundamento legal específico que respalda la tarifa 0 %, por ejemplo artículo 55 de la LRTI y la clasificación del medicamento.';
    if(values.tipoProducto==='medicamento'){
      if(!values.pvpMaximo || Number(values.pvpMaximo)<=0)issues.pvpMaximo='Registra el PVP máximo impreso del medicamento.';
      for(const key of ['laboratorio','presentacion','registroSanitario'])if(!String(values[key] || '').trim())issues[key]='Completa este dato obligatorio para medicamentos.';
    }
    if(values.pvpMaximo && Number(values.precio)>Number(values.pvpMaximo))issues.precio='El precio con IVA antes del descuento no puede superar el PVP máximo impreso.';
  }
  if(form.id==='promotion-form'){
    if(values.imagen && String(values.alt || '').trim().length<2)issues.alt='Describe la imagen de la promoción.';
    if(values.inicio && values.fin && values.fin<=values.inicio)issues.fin='El fin debe ser posterior al inicio, en hora de Ecuador.';
  }
  if(form.id==='supplier-form'){
    if(!V.validRuc(values.ruc))issues.ruc='Escribe un RUC ecuatoriano de 13 dígitos terminado en 001; confirma su inscripción en el SRI.';
    if(!V.validEmail(values.email))issues.email='Escribe un correo electrónico válido.';
    if(!V.normalizePhone(values.telefono))issues.telefono='Usa un teléfono de Ecuador: 09XXXXXXXX, fijo con código de área o +593.';
    if(!/\p{L}/u.test(values.direccion || ''))issues.direccion='Indica calle, numeración o s/n y referencia.';
  }
  if(form.id==='lot-form' && values.vencimiento && values.vencimiento<ecuadorToday())issues.vencimiento='No puedes ingresar un lote vencido. La fecha se compara con hoy en Ecuador.';
  if(form.id==='fiscal-form'){
    if(![13,14,15].includes(Number(values.tarifaGeneral)))issues.tarifaGeneral='Selecciona 13 %, 14 % o 15 % de la normativa general.';
    if(values.inicioVigencia){const time=Date.parse(ecuadorDateTime(values.inicioVigencia));if(time<Date.parse('2024-04-01T05:00:00Z') || time>Date.now()+10*366*86400000)issues.inicioVigencia='Usa una vigencia desde abril de 2024 y dentro de los próximos diez años.';}
  }
  return issues;
}
