import {escape,money} from './common.js';
export function practiceCardView(){return '<label for="payment-practice-number">Número de tarjeta</label><input id="payment-practice-number" name="practiceNumber" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="25" required aria-describedby="payment-practice-brand payment-practice-help"><p id="payment-practice-brand" class="payment-card-brand" role="status" aria-live="polite">Marca por identificar</p><p id="payment-practice-help" class="muted">Usa números inventados. Sólo se reconoce la marca; no se valida una tarjeta bancaria.</p>';}
export function paymentSummary(order){
  document.getElementById('payment-reference').textContent=`Pedido ${order.id.slice(0,8)} · USD`;
  document.getElementById('payment-summary').innerHTML=`<ul class="payment-lines">${order.detalles.map(line=>`<li><span>${escape(line.cantidad)} × ${escape(line.nombreProducto)}</span><strong>${money(line.totalCentavos)}</strong></li>`).join('')}</ul><dl class="payment-totals"><div><dt>Productos</dt><dd>${money(order.subtotalCentavos)}</dd></div><div><dt>Envío</dt><dd>${order.costoEnvioCentavos===0?'Sin costo':money(order.costoEnvioCentavos)}</dd></div>${order.ivaCentavos!=null?`<div><dt>IVA incluido</dt><dd>${money(order.ivaCentavos)}</dd></div>`:''}<div class="payment-total"><dt>Total</dt><dd id="payment-total">${money(order.totalCentavos)}</dd></div></dl>`;
  document.getElementById('payment-transfer-amount').textContent=money(order.totalCentavos);
  document.getElementById('payment-transfer-reference').textContent=order.id;
}
