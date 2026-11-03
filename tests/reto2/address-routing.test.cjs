const {test}=require('node:test'),assert=require('node:assert/strict');
const destination={direccion:'Avenida Principal 123',ciudad:'Puerto Quito',provincia:'Pichincha',latitud:null,longitud:null};
const match={lat:'.125',lon:'-79.25',place_rank:30,addresstype:'building',display_name:'Avenida Principal 123, Puerto Quito, Ecuador',address:{country_code:'ec',state:'Pichincha',town:'Puerto Quito',road:'Avenida Principal',house_number:'123'}};
test('resuelve la dirección guardada, identifica la app, reutiliza resultados y evita destinos de ciudad o ambiguos',async()=>{
 const {createGeocoder}=require('../../server/models/geocoding.cjs');let calls=0;
 const service=createGeocoder({fetch:async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'nominatim.openstreetmap.org');assert(new URL(url).searchParams.get('q').includes(destination.direccion));assert.equal(options.redirect,'error');assert(!options.headers.Authorization);return new Response(JSON.stringify([match]));}});
 const first=await service.resolve(destination);assert.equal(first.latitud,.125);assert.equal(first.longitud,-79.25);assert.equal(first.fuente,'direccion');await service.resolve(destination);assert.equal(calls,1);
 for(const values of [[{...match,place_rank:16,addresstype:'town'}],[{...match,address:{country_code:'co',town:'Puerto Quito'}}],[{...match,address:{...match.address,state:'Azuay'}}],[match,{...match,lat:'.15',lon:'-79.3'}]]){
  const other=createGeocoder({fetch:async()=>new Response(JSON.stringify(values))});await assert.rejects(()=>other.resolve(destination),error=>['ADDRESS_NOT_FOUND','ADDRESS_AMBIGUOUS'].includes(error.code));
 }
});
test('ruta usa dirección automáticamente sin aceptar coordenadas manuales de destino y vuelve a autorizar',async()=>{
 const {createRouting}=require('../../server/models/rutas.cjs');let resolutions=0,closed=false;
 const service=createRouting({find:async()=>closed?{estado:'entregada',destino:null}:{estado:'asignada',destino:destination},resolve:async value=>{assert.equal(value,destination);resolutions++;return {latitud:.125,longitud:-79.25,fuente:'direccion'};},fetch:async()=>new Response(JSON.stringify({code:'Ok',routes:[{distance:1800,duration:300,geometry:{type:'LineString',coordinates:[[-79.24,.12],[-79.25,.125]]}}]}))});
 const route=await service.calculate('own',{}, {latitud:.12,longitud:-79.24});assert.equal(resolutions,1);assert.deepEqual(route.destino,{latitud:.125,longitud:-79.25,fuente:'direccion'});
 closed=true;await assert.rejects(()=>service.calculate('own',{}, {latitud:.12,longitud:-79.24}),error=>error.code==='DELIVERY_CLOSED');assert.equal(resolutions,1);
});
test('ruta nacional permite recorridos terrestres largos de Ecuador conservando límites de abuso',async()=>{
 const {createRouting}=require('../../server/models/rutas.cjs');let called=0;
 const service=createRouting({find:async()=>({estado:'asignada',destino:{...destination,latitud:-2.9,longitud:-79,alcance:'nacional'}}),fetch:async()=>{called++;return Response.json({code:'Ok',routes:[{distance:450000,duration:25000,geometry:{type:'LineString',coordinates:[[-78.47,-.18],[-79,-2.9]]}}]});}});
 assert.equal((await service.calculate('national',{}, {latitud:-.18,longitud:-78.47})).distance,450000);
 await assert.rejects(service.calculate('national',{}, {latitud:40.7,longitud:-74}),error=>error.code==='ROUTE_OUTSIDE_AREA');assert.equal(called,1);
});
