'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('seguimiento muestra código privado, incidencia escapada y ETA caducada sin promesa vigente',async()=>{
 const elements=new Map(),previous=globalThis.document;globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{innerHTML:''});return elements.get(id);}};
 try{const {trackingView}=await import('../../frontend/views/deliveries.js');trackingView({pedidoId:'synthetic-order',estadoPedido:'preparado',entrega:{estado:'en_camino',codigoEntrega:'123456',incidencias:[{id:'incident',tipo:'retraso',descripcion:'Acceso <script> cerrado.',createdAt:new Date().toISOString()}],estimacion:{desde:'2026-11-03T10:00:00Z',hasta:'2026-11-03T10:05:00Z',calculadaAt:'2026-11-03T09:56:00Z',venceAt:'2026-11-03T09:58:00Z',fuente:'OSRM · FOSSGIS',vigente:false,retrasada:true}}});
 const html=elements.get('tracking-content').innerHTML;assert.match(html,/data-delivery-code/);assert.match(html,/123456/);assert.match(html,/Acceso &lt;script&gt; cerrado/);assert.match(html,/Estimación vencida/);assert.match(html,/Retraso/);assert(!html.includes('<script>'));
 }finally{globalThis.document=previous;}
});
