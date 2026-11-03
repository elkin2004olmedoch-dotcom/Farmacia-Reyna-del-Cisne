const {test}=require('node:test');
const assert=require('node:assert/strict');
const views=()=>import('../../frontend/views/order-map.js');
test('retirar en farmacia apunta al marcador exacto de Consulab compartido por el titular',async()=>{
 const {orderMapData}=await views(),data=orderMapData({id:'retiro',estado:'preparado',entrega:'pickup'}),url=new URL(data.directionsUrl);
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('query'),'0.1200092,-79.2580379');
});
const order={id:'pedido-mapa',userId:'cliente-mapa',estado:'preparado',entrega:'delivery',direccion:'Calle Central s/n & Parque',ciudad:'Puerto Quito',provincia:'Pichincha',latitudEntrega:0.125,longitudEntrega:-79.25,ubicacionEntregaAceptadaAt:'2026-11-02T12:00:00Z'};

test('mapa de destino exige coordenadas válidas y consentimiento explícito del pedido',async()=>{
  const {orderMapData,orderMapPanel}=await views(),data=orderMapData(order);
  assert.equal(data.kind,'destination');assert.equal(new URL(data.embedUrl).origin,'https://www.openstreetmap.org');assert.equal(new URL(data.embedUrl).searchParams.get('marker'),'0.125,-79.25');
  assert.equal(new URL(data.directionsUrl).searchParams.get('destination'),'Calle Central s/n & Parque, Puerto Quito, Pichincha, Ecuador');
  for(const changes of [{ubicacionEntregaAceptadaAt:null},{latitudEntrega:null},{latitudEntrega:91},{longitudEntrega:Infinity},{latitudEntrega:'0.125'}])assert.equal(orderMapData({...order,...changes}).point,null);
  const html=orderMapPanel(order);assert.doesNotMatch(html,/<iframe|src=|marker=|0\.125|-79\.25/);assert.match(html,/data-order-map="pedido-mapa"/);assert.doesNotMatch(html,/Calle Central/);
});

test('GPS sólo usa tracking del mismo pedido, estado coincidente y muestra reciente',async()=>{
  const {orderMapData}=await views(),now=Date.parse('2026-11-02T12:01:00Z');
  const tracking={pedidoId:order.id,estadoPedido:'preparado',entrega:{estado:'en_camino',ubicacion:{latitud:0.12,longitud:-79.24,precision:18,registradaAt:'2026-11-02T12:00:50Z'}}};
  assert.equal(orderMapData(order,tracking,now).kind,'courier');
  for(const changed of [{...tracking,pedidoId:'otro-pedido'},{...tracking,entrega:{...tracking.entrega,ubicacion:{...tracking.entrega.ubicacion,precision:NaN}}},{...tracking,entrega:{...tracking.entrega,ubicacion:{...tracking.entrega.ubicacion,registradaAt:'2026-11-02T11:58:00Z'}}}])assert.equal(orderMapData(order,changed,now).kind,'destination');
  for(const changed of [{...tracking,estadoPedido:'cancelado'},{...tracking,entrega:{...tracking.entrega,estado:'entregada'}}])assert.equal(orderMapData(order,changed,now).point,null);
  const withoutConsent={...order,ubicacionEntregaAceptadaAt:null};assert.equal(orderMapData(withoutConsent,tracking,now).kind,'courier');assert.equal(orderMapData(withoutConsent,null,now).embedUrl,null);
});

test('estados finales no generan coordenadas, direcciones ni enlaces Maps aunque el DTO sea antiguo',async()=>{
  const {orderMapData,orderMapPanel}=await views();
  for(const estado of ['entregado','cancelado']){
    const closed={...order,estado},data=orderMapData(closed);assert.equal(data.point,null);assert.equal(data.embedUrl,null);assert.equal(data.directionsUrl,null);
    assert.doesNotMatch(orderMapPanel(closed),/data-order-map=|maps\/|Calle Central|0\.125|-79\.25/);
  }
});

test('retiro usa el punto público del local sin atribuir coordenadas al cliente',async()=>{
  const {orderMapData,orderMapPanel}=await views(),pickup={...order,entrega:'pickup'};
  const data=orderMapData(pickup);assert.equal(data.kind,'pickup');assert.equal(data.point,null);assert.equal(data.embedUrl,null);assert.equal(new URL(data.directionsUrl).searchParams.get('query'),'0.1200092,-79.2580379');
  assert.doesNotMatch(orderMapPanel(pickup),/<iframe|data-order-map=|0\.125|Calle Central/);
});

test('direcciones inseguras e identificadores inválidos no se interpolan en enlaces',async()=>{
  const {orderMapData,orderMapPanel}=await views();
  assert.equal(orderMapData({...order,direccion:'<script>alert(1)</script>'}).directionsUrl,null);assert.doesNotMatch(orderMapPanel({...order,direccion:'<script>alert(1)</script>'}),/<script|alert\(1\)/);
  assert.equal(orderMapPanel({...order,id:'"><script>'}),'');
});
