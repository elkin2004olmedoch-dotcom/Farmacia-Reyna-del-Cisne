import {escape,money} from './common.js';
export function paymentSummary(order){
  document.getElementById('payment-reference').textContent=order.id?`Pedido ${order.id.slice(0,8)} · USD`:'Ejemplo de compra · datos ficticios';
  document.getElementById('payment-summary').innerHTML=`<ul class="payment-lines">${order.detalles.map(line=>`<li><span>${escape(line.cantidad)} × ${escape(line.nombreProducto)}</span><strong>${money(line.totalCentavos)}</strong></li>`).join('')}</ul><dl class="payment-totals"><div><dt>Productos</dt><dd>${money(order.subtotalCentavos)}</dd></div><div><dt>Envío</dt><dd>${order.costoEnvioCentavos===0?'Sin costo':money(order.costoEnvioCentavos)}</dd></div>${order.ivaCentavos!=null?`<div><dt>IVA incluido</dt><dd>${money(order.ivaCentavos)}</dd></div>`:''}<div class="payment-total"><dt>Total${order.id?'':' de ejemplo'}</dt><dd id="payment-total">${money(order.totalCentavos)}</dd></div></dl>`;
}
export function paymentOutcome(outcome){
  for(const [key,value] of Object.entries({symbol:outcome.symbol,title:outcome.title,message:outcome.message}))document.getElementById(`payment-result-${key}`).textContent=value;
  document.getElementById('payment-form').hidden=true;document.getElementById('payment-result').hidden=false;document.getElementById('payment-result-title').focus();
}
