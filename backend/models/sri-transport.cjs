'use strict';
const {escape,parseXml}=require('./sri-crypto.cjs');
const {keyFromXml}=require('./sri-document.cjs');
const {AppError}=require('../middleware/errors.cjs');
const endpoints=Object.freeze({
  '1':Object.freeze({recepcion:'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',autorizacion:'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline'}),
  '2':Object.freeze({recepcion:'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',autorizacion:'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline'})
});
const local=node=>node.localName||node.nodeName.split(':').pop();
const children=(node,name)=>Array.from(node.childNodes||[]).filter(n=>n.nodeType===1&&local(n)===name);
function descendants(node,name){return Array.from(node.getElementsByTagName('*')).filter(n=>local(n)===name);}
function one(node,name,optional=false){const nodes=children(node,name);if(nodes.length!==1){if(optional&&!nodes.length)return '';throw new AppError(502,'SRI_INVALID_RESPONSE','La respuesta del SRI no tiene la estructura esperada.');}return nodes[0].textContent.trim();}
function responseRoot(xml,name){const doc=parseXml(xml);const faults=descendants(doc,'Fault');if(faults.length)throw new AppError(502,'SRI_SERVICE_ERROR','El servicio del SRI devolvió un error. Intenta consultar nuevamente.');const nodes=descendants(doc,name);if(nodes.length!==1)throw new AppError(502,'SRI_INVALID_RESPONSE','La respuesta del SRI no tiene la estructura esperada.');return nodes[0];}
function messages(node){return descendants(node,'mensaje').filter(n=>children(n,'identificador').length).slice(0,15).map(n=>({codigo:one(n,'identificador',true).slice(0,40),mensaje:one(n,'mensaje',true).slice(0,500),informacion:one(n,'informacionAdicional',true).slice(0,500)}));}
function parseReception(xml,key){const root=responseRoot(xml,'RespuestaRecepcionComprobante'),state=one(root,'estado');if(!['RECIBIDA','DEVUELTA'].includes(state))throw new AppError(502,'SRI_INVALID_RESPONSE','El estado de recepción del SRI no es válido.');const keys=descendants(root,'claveAcceso');if(keys.some(k=>k.textContent.trim()!==key))throw new AppError(502,'SRI_KEY_MISMATCH','La respuesta del SRI corresponde a otra factura.');return {estado:state,mensajes:messages(root)};}
function parseAuthorization(xml,key){const root=responseRoot(xml,'RespuestaAutorizacionComprobante');if(one(root,'claveAccesoConsultada')!==key)throw new AppError(502,'SRI_KEY_MISMATCH','La consulta del SRI corresponde a otra factura.');
  const records=descendants(root,'autorizacion');if(records.length>10)throw new AppError(502,'SRI_INVALID_RESPONSE','La respuesta de autorización supera el límite.');
  if(!records.length)return {estado:'EN_PROCESO',mensajes:[]};
  const authorized=records.filter(n=>one(n,'estado')==='AUTORIZADO');if(authorized.length>1)throw new AppError(502,'SRI_INVALID_RESPONSE','El SRI devolvió autorizaciones ambiguas.');
  const record=authorized[0]||records.at(-1),status=one(record,'estado');
  if(status==='AUTORIZADO'){
    const number=one(record,'numeroAutorizacion'),date=one(record,'fechaAutorizacion'),document=one(record,'comprobante'),environment=one(record,'ambiente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(![key[23],key[23]==='1'?'PRUEBAS':'PRODUCCION'].includes(environment))throw new AppError(502,'SRI_ENVIRONMENT_MISMATCH','El ambiente autorizado por el SRI no coincide con la factura.');
    if(number!==key||keyFromXml(document)!==key||!Number.isFinite(Date.parse(date)))throw new AppError(502,'SRI_AUTHORIZATION_MISMATCH','La autorización del SRI no coincide con la factura enviada.');
    return {estado:'AUTORIZADA',numeroAutorizacion:number,fechaAutorizacion:new Date(date),comprobante:document,mensajes:messages(record)};
  }
  if(status==='NO AUTORIZADO')return {estado:'NO_AUTORIZADA',mensajes:messages(record)};
  if(status==='EN PROCESO'||status==='EN_PROCESO')return {estado:'EN_PROCESO',mensajes:messages(record)};
  throw new AppError(502,'SRI_INVALID_RESPONSE','El estado de autorización del SRI no es válido.');
}
async function post(url,body){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{const result=await fetch(url,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'""'},body,signal:controller.signal,redirect:'error'});
    if(!result.ok)throw new AppError(502,'SRI_UNAVAILABLE','El SRI no está disponible. Puedes volver a consultar esta misma factura.');
    if(Number(result.headers.get('content-length'))>2*1024*1024)throw new AppError(502,'SRI_INVALID_RESPONSE','La respuesta del SRI supera el límite permitido.');
    const reader=result.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new AppError(502,'SRI_INVALID_RESPONSE','La respuesta del SRI supera el límite permitido.');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks).toString('utf8');
  }catch(error){if(error instanceof AppError)throw error;throw new AppError(502,'SRI_UNAVAILABLE','No se pudo conectar con el SRI. La factura se conserva para reintentar.');}finally{clearTimeout(timeout);}
}
function createTransport(sender=post){
  const envelope=content=>`<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${content}</soapenv:Body></soapenv:Envelope>`;
  return {
    async receive(ambiente,xml,key){if(!endpoints[ambiente])throw new AppError(400,'INVALID_ENVIRONMENT','El ambiente del SRI no es válido.');const body=envelope(`<rec:validarComprobante xmlns:rec="http://ec.gob.sri.ws.recepcion"><xml>${Buffer.from(xml,'utf8').toString('base64')}</xml></rec:validarComprobante>`);return parseReception(await sender(endpoints[ambiente].recepcion,body),key);},
    async authorize(ambiente,key){if(!endpoints[ambiente])throw new AppError(400,'INVALID_ENVIRONMENT','El ambiente del SRI no es válido.');const body=envelope(`<aut:autorizacionComprobante xmlns:aut="http://ec.gob.sri.ws.autorizacion"><claveAccesoComprobante>${escape(key)}</claveAccesoComprobante></aut:autorizacionComprobante>`);return parseAuthorization(await sender(endpoints[ambiente].autorizacion,body),key);}
  };
}
module.exports={createTransport,parseReception,parseAuthorization,endpoints};
