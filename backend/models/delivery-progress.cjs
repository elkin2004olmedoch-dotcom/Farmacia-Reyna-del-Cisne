'use strict';
const {createHmac,randomBytes,timingSafeEqual}=require('node:crypto');
const {AppError}=require('../middleware/errors.cjs');
const ESTIMATE_CLEAR={estimadaDesde:null,estimadaHasta:null,estimadaCalculadaAt:null,estimadaFuente:null,estimadaGpsVersion:null,estimadaMuestraAt:null,estimadaVenceAt:null,estimadaRepartidorId:null};
const newCode=()=>({codigoEntregaRequerido:true,codigoEntregaNonce:randomBytes(32).toString('hex'),codigoIntentos:0,codigoBloqueadoHasta:null});
function code(delivery,secret=process.env.JWT_SECRET){
 if(!delivery.codigoEntregaRequerido||!delivery.codigoEntregaNonce)return null;
 if(typeof secret!=='string'||secret.length<32)throw new Error('La configuración del código de entrega no está disponible.');
 return String(createHmac('sha256',secret).update('farmacia:delivery-code:v1:'+delivery.id+':'+delivery.codigoEntregaNonce).digest().readUInt32BE(0)%1000000).padStart(6,'0');
}
async function verify(tx,delivery,value){
 if(!delivery.codigoEntregaRequerido)return null;
 if(delivery.codigoBloqueadoHasta>new Date())return new AppError(429,'DELIVERY_CODE_LOCKED','Espera quince minutos antes de volver a intentar el código.');
 if(!value)return new AppError(409,'DELIVERY_CODE_REQUIRED','Pide al destinatario su código de entrega antes de finalizar.');
 const expected=code(delivery),valid=typeof value==='string'&&/^\d{6}$/.test(value)&&expected&&timingSafeEqual(Buffer.from(value),Buffer.from(expected));
 if(valid)return null;
 const attempts=(delivery.codigoBloqueadoHasta?0:delivery.codigoIntentos)+1;
 await tx.entrega.update({where:{id:delivery.id},data:{codigoIntentos:attempts,codigoBloqueadoHasta:attempts>=5?new Date(Date.now()+15*60000):null}});
 return new AppError(attempts>=5?429:422,attempts>=5?'DELIVERY_CODE_LOCKED':'DELIVERY_CODE_INVALID',attempts>=5?'Demasiados códigos incorrectos. Espera quince minutos.':'El código no coincide. Pide al destinatario que revise su seguimiento.');
}
function estimate(delivery,now=new Date()){
 // A newer GPS sample does not renew or erase the last route's own two-minute window.
 // Reassignment and GPS withdrawal clear the metadata; future/regressed origins cannot publish it.
 if(!['en_camino','en_destino'].includes(delivery.estado)||!delivery.estimadaHasta||!delivery.estimadaVenceAt||!delivery.estimadaCalculadaAt||!delivery.estimadaMuestraAt||!delivery.registradaAt||!delivery.recibidaAt||delivery.estimadaFuente!=='OSRM · FOSSGIS'||delivery.estimadaRepartidorId!==delivery.repartidorId||!Number.isSafeInteger(delivery.estimadaGpsVersion)||delivery.estimadaGpsVersion<0||!Number.isSafeInteger(delivery.gpsVersion)||delivery.estimadaGpsVersion>delivery.gpsVersion||delivery.estimadaMuestraAt>delivery.registradaAt||delivery.estimadaMuestraAt-delivery.estimadaCalculadaAt>15000||delivery.estimadaVenceAt.getTime()>Math.min(delivery.estimadaMuestraAt.getTime()+120000,delivery.estimadaCalculadaAt.getTime()+120000))return null;
 const expired=delivery.estimadaVenceAt<=now||!delivery.registradaAt||!delivery.recibidaAt||now-delivery.registradaAt>120000||now-delivery.recibidaAt>120000||delivery.registradaAt-now>15000;
 return {desde:delivery.estimadaDesde,hasta:delivery.estimadaHasta,calculadaAt:delivery.estimadaCalculadaAt,fuente:delivery.estimadaFuente,venceAt:delivery.estimadaVenceAt,vigente:!expired,retrasada:now>delivery.estimadaHasta,margenMinutos:5};
}
async function saveEstimate(item,result){
 const point=item.ubicacion,now=new Date();
 if(!point||!Number.isSafeInteger(item.gpsVersion)||!item.repartidorId||!['en_camino','en_destino'].includes(item.estado)||!Number.isFinite(result.duration)||result.duration<0||result.duration>7*86400)return;
 const sample=new Date(point.registradaAt);if(now-sample>120000||sample-now>15000)return;
 const duration=Math.ceil(result.duration*1000),arrives=new Date(now.getTime()+duration),latest=new Date(arrives.getTime()+5*60000),expires=new Date(Math.min(now.getTime()+120000,sample.getTime()+120000));
 await require('./db.cjs').entrega.updateMany({where:{id:item.id,version:item.version,gpsVersion:item.gpsVersion,repartidorId:item.repartidorId,estado:item.estado,registradaAt:sample,recibidaAt:{gte:new Date(now.getTime()-120000)},latitud:point.latitud,longitud:point.longitud},data:{estimadaDesde:arrives,estimadaHasta:latest,estimadaCalculadaAt:now,estimadaFuente:'OSRM · FOSSGIS',estimadaGpsVersion:item.gpsVersion,estimadaMuestraAt:sample,estimadaVenceAt:expires,estimadaRepartidorId:item.repartidorId}});
}
const incidenceSelect={id:true,tipo:true,descripcion:true,resueltaAt:true,createdAt:true,updatedAt:true};
module.exports={ESTIMATE_CLEAR,newCode,code,verify,estimate,saveEstimate,incidenceSelect};
