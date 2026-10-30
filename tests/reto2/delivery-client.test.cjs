const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const client=()=>import(pathToFileURL(path.resolve('frontend/models/deliveries.js')).href);

test('la cotización distingue retiro, tarifa pendiente, gratuidad explícita y envío cobrado',async()=>{
  const {deliveryQuote}=await client();
  assert.deepEqual(deliveryQuote(1000,'pickup',null),{enabled:true,shipping:0,total:1000});
  assert.equal(deliveryQuote(1000,'delivery',{tarifaCentavos:null,activa:true}).enabled,false);
  assert.deepEqual(deliveryQuote(1000,'delivery',{tarifaCentavos:0,activa:true}),{enabled:true,shipping:0,total:1000});
  assert.deepEqual(deliveryQuote(1000,'delivery',{tarifaCentavos:125,activa:true}),{enabled:true,shipping:125,total:1125});
  assert.equal(deliveryQuote(1000,'delivery',{tarifaCentavos:125,activa:false}).enabled,false);
});
test('Maps recibe coordenadas finitas o una dirección codificada y ningún dato clínico',async()=>{
  const {mapsLocationUrl,mapsDirectionsUrl,embedMapUrl}=await client();
  const location=new URL(mapsLocationUrl({latitud:0.124,longitud:-79.26}));assert.equal(location.origin,'https://www.google.com');assert.equal(location.searchParams.get('api'),'1');assert.equal(location.searchParams.get('query'),'0.124,-79.26');
  const route=new URL(mapsDirectionsUrl({direccion:'Calle Principal y Comercio',ciudad:'Puerto Quito',provincia:'Pichincha'}));assert.match(route.searchParams.get('destination'),/Puerto Quito.*Ecuador/);assert.equal(route.searchParams.get('travelmode'),'driving');
  assert.equal(mapsLocationUrl({latitud:NaN,longitud:2}),null);assert.equal(mapsLocationUrl({latitud:91,longitud:2}),null);assert.equal(mapsDirectionsUrl({direccion:'javascript:alert(1)'}),null);
  assert.equal(new URL(embedMapUrl({latitud:0.124,longitud:-79.26})).origin,'https://www.openstreetmap.org');assert.equal(embedMapUrl(null),null);
});
