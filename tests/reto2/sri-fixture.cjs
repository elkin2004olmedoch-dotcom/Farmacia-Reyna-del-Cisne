'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {opensslPath}=require('../../server/models/sri-crypto.cjs');
function certificateFixture(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-sri-synthetic-')),password='SyntheticP12TestOnly!';
  const run=args=>{const result=spawnSync(opensslPath(),args,{encoding:'utf8',timeout:12000,maxBuffer:1048576,windowsHide:true,env:{...process.env,FARMACIA_SYNTHETIC_PASSWORD:password}});if(result.status!==0)throw new Error('Synthetic certificate generation failed');};
  const key=path.join(directory,'synthetic.key'),certificate=path.join(directory,'synthetic.pem'),p12=path.join(directory,'synthetic.p12');
  run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',certificate,'-days','730','-subj','/C=EC/O=PRUEBA SIN VALIDEZ/CN=Firma Sintetica Test/serialNumber=1790016919001']);
  run(['pkcs12','-export','-out',p12,'-inkey',key,'-in',certificate,'-passout','env:FARMACIA_SYNTHETIC_PASSWORD']);
  const cleanup=()=>{const target=path.resolve(directory),root=path.resolve(os.tmpdir()),relative=path.relative(root,target);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(target).startsWith('farmacia-sri-synthetic-'))throw new Error('Unsafe synthetic fixture cleanup');if(!fs.existsSync(target))return;const stat=fs.lstatSync(target);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe synthetic fixture directory');fs.rmSync(target,{recursive:true,force:true});};
  const value={archivoBase64:fs.readFileSync(p12).toString('base64'),password,certificatePem:fs.readFileSync(certificate,'utf8'),cleanup};
  fs.rmSync(key);fs.rmSync(p12);fs.rmSync(certificate);return value;
}
const emitter={ruc:'1790016919001',razonSocial:'FARMACIA PRUEBA SINTETICA',nombreComercial:'Farmacia Test',direccionMatriz:'Calle Prueba 123 Quito',direccionEstablecimiento:'Calle Prueba 123 Quito',establecimiento:'001',puntoEmision:'001',ambiente:'1',obligadoContabilidad:false,softwarePropio:true,rucProveedorSoftware:null};
const buyer={pedidoId:'pedido-sintetico',tipoIdentificacion:'05',identificacionComprador:'0102030400',razonSocialComprador:'Cliente Prueba',direccionComprador:'Calle Prueba 123 Quito',correoComprador:'prueba@example.ec',formaPago:'01'};
function orderFixture(){return {id:buyer.pedidoId,estado:'confirmado',total:'11.50',baseImponible:'10.00',ivaMonto:'1.50',detalles:[{productoId:'producto-sintetico',nombreProducto:'Producto <prueba> & bienestar',cantidad:2,precioUnitario:'5.75',precioOriginal:'11.50',descuentoPorcentaje:50,ivaPorcentaje:15,baseImponible:'10.00',ivaMonto:'1.50',totalLinea:'11.50'}]};}
const soap=value=>`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${value}</soap:Body></soap:Envelope>`;
function reception(key,state='RECIBIDA'){return soap(`<ns:validarComprobanteResponse xmlns:ns="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>${state}</estado><comprobantes>${state==='DEVUELTA'?`<comprobante><claveAcceso>${key}</claveAcceso><mensajes><mensaje><identificador>35</identificador><mensaje>DOCUMENTO INVALIDO</mensaje><tipo>ERROR</tipo></mensaje></mensajes></comprobante>`:''}</comprobantes></RespuestaRecepcionComprobante></ns:validarComprobanteResponse>`);}
function authorization(key,xml,state='AUTORIZADO'){return soap(`<ns:autorizacionComprobanteResponse xmlns:ns="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${key}</claveAccesoConsultada><numeroComprobantes>${state==='PENDIENTE'?0:1}</numeroComprobantes><autorizaciones>${state==='PENDIENTE'?'':`<autorizacion><estado>${state}</estado><numeroAutorizacion>${key}</numeroAutorizacion><fechaAutorizacion>2026-10-11T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[${xml}]]></comprobante><mensajes/></autorizacion>`}</autorizaciones></RespuestaAutorizacionComprobante></ns:autorizacionComprobanteResponse>`);}
module.exports={certificateFixture,emitter,buyer,orderFixture,soap,reception,authorization};
