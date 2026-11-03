// Shared by the web workspace and the locally packaged courier app.
let library;
function loadLeaflet(base){
  if(globalThis.L)return Promise.resolve(globalThis.L);
  if(library)return library;
  library=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('leaflet.css',base);document.head.append(css);
    const script=document.createElement('script');script.src=new URL('leaflet.js',base);script.onload=()=>resolve(globalThis.L);script.onerror=()=>{library=null;reject(new Error('No se pudo cargar el mapa. Actualiza la app.'));};document.head.append(script);
  });return library;
}
const point=value=>value && typeof value.latitud==='number' && typeof value.longitud==='number' && Number.isFinite(value.latitud) && Number.isFinite(value.longitud) && Math.abs(value.latitud)<=90 && Math.abs(value.longitud)<=180;
const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
const control=text=>{const button=node('button',text);button.type='button';button.className='button button-outline';return button;};
export async function createRouteMap(root,{destination,requestRoute,assetBase=new URL('../assets/vendor/leaflet/',import.meta.url)}={}){
  const L=await loadLeaflet(assetBase);
  let disposed=false,origin=null,end=point(destination)?{latitud:destination.latitud,longitud:destination.longitud}:null,marker,line,pending=false,attemptAt=0,sequence=0,framed=false;
  root.replaceChildren();root.classList.add('courier-route');
  const mapNode=node('div');mapNode.className='courier-route-map';mapNode.setAttribute('aria-label','Mapa de la ruta de entrega');mapNode.setAttribute('role','region');mapNode.tabIndex=0;
  const status=node('p','Esperando una ubicación reciente para calcular la ruta.');status.className='courier-route-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const update=control('Actualizar ruta'),center=control('Centrar recorrido'),toolbar=node('div');toolbar.className='delivery-actions';toolbar.append(update,center);
  const consent=node('p','Mapa dentro de la app. OpenStreetMap recibe las zonas vistas y FOSSGIS las coordenadas para calcular la ruta. La ruta es orientativa: respeta las señales de tránsito.');consent.className='muted';
  root.append(consent,mapNode,status,toolbar);
  const map=L.map(mapNode,{scrollWheelZoom:false,zoomControl:true}).setView(end?[end.latitud,end.longitud]:[0.125,-79.25],end?16:13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
  map.attributionControl.addAttribution('<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">OSRM · FOSSGIS</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Corregir mapa</a>');
  let destinationMarker;
  function showDestination(){if(destinationMarker)map.removeLayer(destinationMarker);if(end)destinationMarker=L.circleMarker([end.latitud,end.longitud],{radius:10,color:'#681e2a',fillColor:'#b51c36',fillOpacity:1}).addTo(map).bindTooltip(node('span','Destino de entrega'));}
  function fit(){const points=[];if(end)points.push([end.latitud,end.longitud]);if(origin)points.push([origin.latitud,origin.longitud]);if(points.length){const bounds=L.latLngBounds(points);if(line)bounds.extend(line.getBounds());map.fitBounds(bounds,{padding:[30,30],maxZoom:16,animate:false});}}
  showDestination();
  if(!end){
    const form=node('form');form.className='courier-route-destination';
    const note=node('p','Este pedido no incluye un punto GPS. Ubica el destino con un toque en el mapa o escribe sus coordenadas y confírmalo. Sólo se usa para navegar; no cambia la dirección del pedido.');form.append(note);
    const fields={};
    for(const [name,label,min,max]of [['latitud','Latitud del destino',-90,90],['longitud','Longitud del destino',-180,180]]){
      const wrap=node('label',label),input=node('input');input.type='number';input.name=name;input.step='any';input.min=min;input.max=max;input.required=true;input.inputMode='decimal';input.autocomplete='off';fields[name]=input;wrap.append(input);form.append(wrap);
    }
    const confirm=control('Confirmar destino de navegación');confirm.type='submit';form.append(confirm);root.append(form);
    map.on('click',event=>{fields.latitud.value=event.latlng.lat.toFixed(6);fields.longitud.value=event.latlng.lng.toFixed(6);});
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;sequence++;end={latitud:Number(fields.latitud.value),longitud:Number(fields.longitud.value)};showDestination();attemptAt=0;void route(true);});
  }
  const recent=()=>point(origin) && Date.now()-Date.parse(origin.registradaAt)<120000 && Date.parse(origin.registradaAt)-Date.now()<=15000;
  function removeLine(){if(line){map.removeLayer(line);line=null;}}
  async function route(force=false){
    if(disposed || pending || document.hidden)return;
    if(!recent()){removeLine();status.textContent='Sin ubicación GPS reciente. Inicia el recorrido o revisa los permisos del teléfono.';return;}
    if(!end){status.textContent='Confirma el destino de navegación para trazar la ruta.';return;}
    if(Date.now()-attemptAt<(force?5000:30000))return;
    pending=true;update.disabled=true;attemptAt=Date.now();const id=++sequence;
    status.textContent='Calculando la ruta por las calles…';
    try{
      const input={latitud:origin.latitud,longitud:origin.longitud,...(!point(destination)?{latitudDestino:end.latitud,longitudDestino:end.longitud}:{})};
      const data=await requestRoute(input);if(disposed || id!==sequence)return;
      const coordinates=data.geometry?.coordinates;
      if(data.geometry?.type!=='LineString'||!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>20000||coordinates.some(p=>!Array.isArray(p)||p.length!==2||!point({latitud:p[1],longitud:p[0]}))||!Number.isFinite(data.distance)||data.distance<0)throw new Error('La ruta recibida no es válida.');
      if(!recent()){removeLine();status.textContent='La ubicación venció. Esperando una nueva muestra GPS.';return;}
      removeLine();line=L.polyline(coordinates.map(p=>[p[1],p[0]]),{color:'#b51c36',weight:6,opacity:.9}).addTo(map);
      status.textContent='Ruta actualizada · '+new Intl.NumberFormat('es-EC',{maximumFractionDigits:1}).format(data.distance/1000)+' km por calles · '+new Intl.DateTimeFormat('es-EC',{timeStyle:'short'}).format(new Date())+'.';
      if(!framed){fit();framed=true;}
    }catch(error){if(!disposed && id===sequence){removeLine();status.textContent=error.message || 'No se pudo calcular la ruta. Vuelve a intentarlo.';if([401,403,404].includes(error.status)){origin=null;root.replaceChildren(node('p','Ya no tienes acceso a esta ruta.'));map.remove();disposed=true;clearInterval(timer);}}}
    finally{pending=false;if(!disposed)update.disabled=false;}
  }
  update.addEventListener('click',()=>void route(true));center.addEventListener('click',fit);
  const timer=setInterval(()=>{if(disposed)return;if(!recent() && marker){map.removeLayer(marker);marker=null;removeLine();status.textContent='Sin ubicación GPS reciente. Comprueba la señal y los permisos.';}void route();},5000);
  return {
    update(position){if(disposed)return;if(position===null){origin=null;if(marker){map.removeLayer(marker);marker=null;}removeLine();status.textContent='Ubicación detenida. Inicia o reanuda el seguimiento para actualizar la ruta.';return;}if(!point(position))return;origin={latitud:position.latitud,longitud:position.longitud,registradaAt:position.registradaAt};if(recent()){if(marker)marker.setLatLng([origin.latitud,origin.longitud]);else marker=L.circleMarker([origin.latitud,origin.longitud],{radius:8,color:'#fff',weight:3,fillColor:'#2563a3',fillOpacity:1}).addTo(map).bindTooltip(node('span','Tu última ubicación GPS'));}void route();},
    dispose(){if(disposed)return;disposed=true;sequence++;clearInterval(timer);origin=null;end=null;map.remove();root.replaceChildren();},
  };
}
