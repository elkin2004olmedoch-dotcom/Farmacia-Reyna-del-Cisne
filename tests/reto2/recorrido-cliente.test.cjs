const test=require('node:test'),assert=require('node:assert/strict');
const {recorridoCliente}=require('../../server/models/recorrido-cliente.cjs');
test('el recorrido depende del pago marcado y de su hora, incluso tras cerrar el navegador',()=>{
  const createdAt=new Date('2026-11-23T20:00:00Z'),order={entrega:'delivery',estado:'pendiente',pagoPractica:{createdAt,recorridoAutomatico:true}};
  for(const [ms,label] of [[0,'Confirmado'],[7999,'Confirmado'],[8000,'En preparación'],[18000,'En camino'],[32000,'Entregado']])assert.equal(recorridoCliente(order,+createdAt+ms).etiqueta,label);
  assert.equal(recorridoCliente({...order,entrega:'pickup'},+createdAt+36000).etiqueta,'Retirado');
  assert.equal(recorridoCliente({...order,estado:'cancelado'},+createdAt+33000).etiqueta,'Cancelado');
  for(const pagoPractica of [null,{createdAt},{createdAt,recorridoAutomatico:false}])assert.equal(recorridoCliente({...order,pagoPractica}),null);
});
