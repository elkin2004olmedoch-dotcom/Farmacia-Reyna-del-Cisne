'use strict';
const crypto=require('node:crypto');
const {escape,parseXml}=require('./sri-crypto.cjs');
const {AppError}=require('../middleware/errors.cjs');
const EC=require('../../frontend/models/ecuador.js');
const taxCodes={0:'0',13:'10',14:'3',15:'4'};
const money=cents=>(cents/100).toFixed(2);
const cents=value=>Math.round(Number(value)*100);
const text=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max&&!/[<>\x00-\x1f]/.test(value);
function validation(fields){throw new AppError(422,'VALIDATION_FAILED','Revisa los datos de facturación.',Object.entries(fields).map(([field,message])=>({field,message})));}
function validateConfig(input,previous) {
  if(!input||typeof input!=='object'||Array.isArray(input))validation({configuracion:'Completa los datos del emisor.'});
  const allowed=['ruc','razonSocial','nombreComercial','direccionMatriz','direccionEstablecimiento','establecimiento','puntoEmision','ambiente','obligadoContabilidad','softwarePropio','rucProveedorSoftware','confirmarProduccion'];
  const errors={};for(const key of Object.keys(input))if(!allowed.includes(key))errors[key]='Campo no permitido.';
  if(typeof input.ruc!=='string'||!EC.validRuc(input.ruc))errors.ruc='Escribe el RUC de 13 dígitos del emisor registrado en el SRI.';
  if(!text(input.razonSocial,2,300))errors.razonSocial='Usa entre 2 y 300 caracteres.';
  const commercial=input.nombreComercial==null||input.nombreComercial===''?input.razonSocial:input.nombreComercial;
  if(!text(commercial,2,300))errors.nombreComercial='Usa entre 2 y 300 caracteres o deja vacío para usar la razón social.';
  for(const key of ['direccionMatriz','direccionEstablecimiento'])if(!text(input[key],8,300))errors[key]='Usa entre 8 y 300 caracteres.';
  for(const key of ['establecimiento','puntoEmision'])if(typeof input[key]!=='string'||!/^\d{3}$/.test(input[key])||input[key]==='000')errors[key]='Usa tres dígitos del 001 al 999.';
  if(!['1','2'].includes(input.ambiente))errors.ambiente='Elige PRUEBAS o PRODUCCIÓN.';
  if(input.ambiente==='2'&&previous?.ambiente!=='2'&&input.confirmarProduccion!==true)errors.confirmarProduccion='Confirma expresamente la emisión en PRODUCCIÓN.';
  for(const key of ['obligadoContabilidad','softwarePropio'])if(typeof input[key]!=='boolean')errors[key]='Selecciona sí o no.';
  if(input.softwarePropio===false&&(typeof input.rucProveedorSoftware!=='string'||!EC.validRuc(input.rucProveedorSoftware)))errors.rucProveedorSoftware='Escribe el RUC real del proveedor del software.';
  if(Object.keys(errors).length)validation(errors);
  return Object.fromEntries(allowed.filter(key=>key!=='confirmarProduccion').map(key=>[key,key==='nombreComercial'?commercial.trim():key==='rucProveedorSoftware'?(input.softwarePropio?null:input[key].trim()):typeof input[key]==='string'?input[key].trim():input[key]]));
}
function validateBuyer(input) {
  const errors={},allowed=['pedidoId','tipoIdentificacion','identificacionComprador','razonSocialComprador','direccionComprador','correoComprador','formaPago'];
  if(!input||typeof input!=='object'||Array.isArray(input))validation({pedidoId:'Selecciona un pedido.'});
  for(const key of Object.keys(input))if(!allowed.includes(key))errors[key]='Campo no permitido.';
  if(typeof input.pedidoId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(input.pedidoId))errors.pedidoId='Selecciona un pedido válido.';
  if(!['04','05'].includes(input.tipoIdentificacion))errors.tipoIdentificacion='Elige RUC o cédula.';
  else if(typeof input.identificacionComprador!=='string'||!(input.tipoIdentificacion==='04'?EC.validRuc(input.identificacionComprador):EC.validCedula(input.identificacionComprador)))errors.identificacionComprador='Escribe una identificación ecuatoriana válida.';
  if(!text(input.razonSocialComprador,2,300))errors.razonSocialComprador='Usa entre 2 y 300 caracteres.';
  if(!text(input.direccionComprador,8,300))errors.direccionComprador='Escribe una dirección completa de 8 a 300 caracteres.';
  if(typeof input.correoComprador!=='string'||!EC.validEmail(input.correoComprador))errors.correoComprador='Escribe un correo válido.';
  if(!['01','15','16','17','18','19','20','21'].includes(input.formaPago))errors.formaPago='Selecciona la forma de pago real de esta factura.';
  if(Object.keys(errors).length)validation(errors);
  return Object.fromEntries(allowed.map(key=>[key,input[key].trim()]));
}
function snapshot(order,buyer,config) {
  if(order.estado==='cancelado')throw new AppError(409,'ORDER_CANCELLED','No se puede facturar un pedido cancelado.');
  if(!order.detalles.length||order.baseImponible==null||order.ivaMonto==null||order.detalles.some(d=>[d.ivaPorcentaje,d.baseImponible,d.ivaMonto,d.totalLinea,d.precioOriginal].some(v=>v==null)))throw new AppError(409,'NEED_TAX_SNAPSHOT','Este pedido histórico no guarda el detalle de IVA. Requiere conciliación contable antes de facturarlo.');
  const lines=order.detalles.map(d=>{
    if(!Object.hasOwn(taxCodes,d.ivaPorcentaje))throw new AppError(409,'UNSUPPORTED_TAX','El pedido contiene una tarifa de IVA no admitida para esta farmacia.');
    const base=cents(d.baseImponible),tax=cents(d.ivaMonto),total=cents(d.totalLinea),originalBase=Math.max(base,Math.round(cents(d.precioOriginal)*d.cantidad*100/(100+d.ivaPorcentaje)));
    if(base+tax!==total||Math.abs(Math.round(base*d.ivaPorcentaje/100)-tax)>1)throw new AppError(409,'INVALID_TAX_SNAPSHOT','Los importes fiscales del pedido no cuadran. Requiere conciliación contable.');
    return {codigo:d.productoId.slice(0,25),descripcion:d.nombreProducto,cantidad:d.cantidad,precioUnitarioSinIva:(originalBase/100/d.cantidad).toFixed(6),descuento:originalBase-base,base,iva:tax,total,tarifa:d.ivaPorcentaje};
  });
  if(order.envioIvaPorcentaje!=null || order.costoEnvioCentavos>0) {
    const rate=order.envioIvaPorcentaje,base=cents(order.envioBaseImponible),tax=cents(order.envioIvaMonto),total=order.costoEnvioCentavos;
    if(!Object.hasOwn(taxCodes,rate)||order.envioBaseImponible==null||order.envioIvaMonto==null||!Number.isSafeInteger(total)||base+tax!==total||Math.abs(Math.round(base*rate/100)-tax)>1)throw new AppError(409,'INVALID_TAX_SNAPSHOT','Los importes fiscales del envío no cuadran.');
    lines.push({codigo:'SERV-ENVIO',descripcion:'Servicio de entrega a domicilio',cantidad:1,precioUnitarioSinIva:(base/100).toFixed(6),descuento:0,base,iva:tax,total,tarifa:rate});
  }
  if(lines.reduce((sum,l)=>sum+l.base,0)!==cents(order.baseImponible)||lines.reduce((sum,l)=>sum+l.iva,0)!==cents(order.ivaMonto)||lines.reduce((sum,l)=>sum+l.total,0)!==cents(order.total))throw new AppError(409,'INVALID_TAX_SNAPSHOT','Los totales del pedido no cuadran con sus productos y envío.');
  return {pedidoId:order.id,comprador:buyer,emisor:config,lineas:lines,total:cents(order.total),base:cents(order.baseImponible),iva:cents(order.ivaMonto),descuento:lines.reduce((sum,l)=>sum+l.descuento,0)};
}
function ecuadorDate(date=new Date()) {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Guayaquil',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(date).map(p=>[p.type,p.value]));return {clave:parts.day+parts.month+parts.year,xml:`${parts.day}/${parts.month}/${parts.year}`};}
function mod11(value) {let sum=0,weight=2;for(let i=value.length-1;i>=0;i--){sum+=Number(value[i])*weight;weight=weight===7?2:weight+1;}const digit=11-sum%11;return digit===11?0:digit===10?1:digit;}
function accessKey(config,sequence,date=new Date(),numeric=crypto.randomInt(0,100000000).toString().padStart(8,'0')) {
  const core=ecuadorDate(date).clave+'01'+config.ruc+config.ambiente+config.establecimiento+config.puntoEmision+String(sequence).padStart(9,'0')+numeric+'1';
  if(!/^\d{48}$/.test(core)||!Number.isInteger(sequence)||sequence<1||sequence>999999999)throw new AppError(409,'INVALID_SEQUENCE','La numeración de facturación no es válida.');return core+mod11(core);
}
function buildXml(data,key=null,sequence=null,date=new Date()) {
  const e=data.emisor,b=data.comprador,taxes=new Map();for(const l of data.lineas){const group=taxes.get(l.tarifa)||{base:0,iva:0};group.base+=l.base;group.iva+=l.iva;taxes.set(l.tarifa,group);}
  const tags=(entries)=>entries.map(([key,value])=>`<${key}>${escape(value)}</${key}>`).join('');
  const info=tags([['ambiente',e.ambiente],['tipoEmision','1'],['razonSocial',e.razonSocial],['nombreComercial',e.nombreComercial],['ruc',e.ruc],['claveAcceso',key||'0'.repeat(49)],['codDoc','01'],['estab',e.establecimiento],['ptoEmi',e.puntoEmision],['secuencial',sequence?String(sequence).padStart(9,'0'):'000000000'],['dirMatriz',e.direccionMatriz]]);
  const totals=[...taxes].map(([rate,t])=>`<totalImpuesto>${tags([['codigo','2'],['codigoPorcentaje',taxCodes[rate]],['baseImponible',money(t.base)],['valor',money(t.iva)]])}</totalImpuesto>`).join('');
  const details=data.lineas.map(l=>`<detalle>${tags([['codigoPrincipal',l.codigo],['descripcion',l.descripcion],['cantidad',l.cantidad.toFixed(6)],['precioUnitario',l.precioUnitarioSinIva],['descuento',money(l.descuento)],['precioTotalSinImpuesto',money(l.base)]])}<impuestos><impuesto>${tags([['codigo','2'],['codigoPorcentaje',taxCodes[l.tarifa]],['tarifa',l.tarifa.toFixed(2)],['baseImponible',money(l.base)],['valor',money(l.iva)]])}</impuesto></impuestos></detalle>`).join('');
  const fact=tags([['fechaEmision',ecuadorDate(date).xml],['dirEstablecimiento',e.direccionEstablecimiento],['obligadoContabilidad',e.obligadoContabilidad?'SI':'NO'],['tipoIdentificacionComprador',b.tipoIdentificacion],['razonSocialComprador',b.razonSocialComprador],['identificacionComprador',b.identificacionComprador],['direccionComprador',b.direccionComprador],['totalSinImpuestos',money(data.base)],['totalDescuento',money(data.descuento)]]);
  const additional=`<campoAdicional nombre="Email">${escape(b.correoComprador)}</campoAdicional>`+(!e.softwarePropio?`<campoAdicional nombre="RUC Proveedor">${escape(e.rucProveedorSoftware)}</campoAdicional>`:'');
  return `<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="2.1.0"><infoTributaria>${info}</infoTributaria><infoFactura>${fact}<totalConImpuestos>${totals}</totalConImpuestos><propina>0.00</propina><importeTotal>${money(data.total)}</importeTotal><moneda>DOLAR</moneda><pagos><pago><formaPago>${escape(b.formaPago)}</formaPago><total>${money(data.total)}</total></pago></pagos></infoFactura><detalles>${details}</detalles><infoAdicional>${additional}</infoAdicional></factura>`;
}
function keyFromXml(xml){const doc=parseXml(xml),keys=doc.getElementsByTagName('claveAcceso');if(doc.documentElement.nodeName!=='factura'||keys.length!==1)return null;return keys[0].textContent;}
module.exports={validateConfig,validateBuyer,snapshot,ecuadorDate,mod11,accessKey,buildXml,keyFromXml,money};
