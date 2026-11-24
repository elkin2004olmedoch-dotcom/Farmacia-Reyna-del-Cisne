import {escape} from './common.js';

export function recorridoView(recorrido){
  if(recorrido.cancelado)return '<h3>Pedido cancelado</h3>';
  return `<h3>Seguimiento de tu pedido</h3><p role="status" class="order-tracking-note">${escape(recorrido.etiqueta)}</p><ol class="order-tracking-steps" aria-label="Etapas del pedido">${recorrido.etapas.map((label,i)=>{
    const current=i===recorrido.indice,complete=i<recorrido.indice;
    return `<li class="order-tracking-step is-${current?'current':complete?'complete':'upcoming'}"${current?' aria-current="step"':''}><span class="order-tracking-icon" aria-hidden="true">${complete?'✓':i+1}</span><strong>${escape(label)}</strong></li>`;
  }).join('')}</ol>`;
}
