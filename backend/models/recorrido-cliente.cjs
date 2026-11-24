// A paid practice order has its own timeline. It never creates a physical handoff.
const delivery=['Confirmado','En preparación','En camino','Entregado'];
const pickup=['Confirmado','En preparación','Listo para retirar','Retirado'];
const milestones=[0,8000,18000,32000];
function recorridoCliente(order,now=Date.now()){
  if(!order.pagoPractica?.recorridoAutomatico)return null;
  const etapas=order.entrega==='pickup'?pickup:delivery;
  const elapsed=now-new Date(order.pagoPractica.createdAt).getTime();
  const indice=Math.max(0,milestones.findLastIndex(offset=>elapsed>=offset));
  const cancelado=order.estado==='cancelado';
  return {etapas,indice,etiqueta:cancelado?'Cancelado':etapas[indice],cancelado,finalizado:cancelado||indice===etapas.length-1};
}
module.exports={recorridoCliente};
