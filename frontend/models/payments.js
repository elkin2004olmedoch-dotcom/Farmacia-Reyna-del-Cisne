import {request} from './api.js';
export const payments={
  configuration:()=>request('/pagos/configuracion'),
  forOrder:id=>request(`/pedidos/${encodeURIComponent(id)}/pago`),
  prepare:id=>request(`/pedidos/${encodeURIComponent(id)}/pago/payphone`,{method:'POST',body:{}})
};
export function payphoneUrl(value){
  try{const url=new URL(value);if(url.protocol==='https:' && url.hostname==='pay.payphonetodoesposible.com' && !url.port && !url.username && !url.password && !url.hash && /^\/(Anonymous|PayPhone)\/Index$/.test(url.pathname) && url.searchParams.get('paymentId'))return url.href;}catch{}
  throw new Error('No pudimos verificar la dirección de PayPhone. Consulta con la farmacia antes de continuar.');
}
export const demoOrder=Object.freeze({id:null,moneda:'USD',totalCentavos:1850,subtotalCentavos:1850,costoEnvioCentavos:0,ivaCentavos:null,detalles:[{nombreProducto:'Cuidado personal · ejemplo',cantidad:1,totalCentavos:1000},{nombreProducto:'Bienestar · ejemplo',cantidad:1,totalCentavos:850}]});
export function demoResult(value){
  const outcomes={aprobado:{symbol:'✓',title:'Prueba aprobada',message:'Así se verá una aprobación. No se ha cobrado dinero ni se ha registrado un pago o pedido.'},rechazado:{symbol:'!',title:'Prueba rechazada',message:'Así se verá un rechazo. Puedes revisar el método y volver a probar. No se ha realizado ningún cobro.'},cancelado:{symbol:'−',title:'Prueba cancelada',message:'Has cancelado esta demostración. No hay cobros ni pedidos que anular.'}};
  if(!Object.hasOwn(outcomes,value))throw new Error('Selecciona un resultado de prueba válido.');
  return outcomes[value];
}
