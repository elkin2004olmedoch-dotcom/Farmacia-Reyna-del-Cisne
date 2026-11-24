import {request} from './api.js';
export const payments={
  checkoutConfiguration:()=>request('/pagos/checkout-configuracion'),
  configuration:()=>request('/pagos/configuracion'),
  forOrder:id=>request(`/pedidos/${encodeURIComponent(id)}/pago`),
  prepare:id=>request(`/pedidos/${encodeURIComponent(id)}/pago/payphone`,{method:'POST',body:{}}),
  practice:(id,values)=>request(`/pedidos/${encodeURIComponent(id)}/pago/practica`,{method:'POST',body:values})
};
export function payphoneUrl(value){
  try{const url=new URL(value);if(url.protocol==='https:' && url.hostname==='pay.payphonetodoesposible.com' && !url.port && !url.username && !url.password && !url.hash && /^\/(Anonymous|PayPhone)\/Index$/.test(url.pathname) && url.searchParams.get('paymentId'))return url.href;}catch{}
  throw new Error('No pudimos verificar la dirección de PayPhone. Consulta con la farmacia antes de continuar.');
}
