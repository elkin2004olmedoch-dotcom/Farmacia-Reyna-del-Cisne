// Standalone classroom transport: no server imports, credentials, fetch or production storage.
export const CLASSROOM_STATE_KEY='farmacia-clase-negocio-v1';
const LIMIT=100,MAX_BYTES=700000;
const profiles={
  'clase-user':{id:'clase-cliente',nombre:'Cliente de clase',email:'cliente@example.invalid',telefono:'0990000000',role:'user',activo:true},
  'clase-admin':{id:'clase-administrador',nombre:'Administración de clase',email:'admin@example.invalid',telefono:'0990000000',role:'admin',activo:true},
  'clase-repartidor':{id:'clase-repartidor',nombre:'Repartidor de clase',email:'repartidor@example.invalid',telefono:'0990000000',role:'repartidor',activo:true},
};
const orderStates={pendiente:['confirmado','cancelado'],confirmado:['preparado','cancelado'],preparado:['entregado','cancelado'],entregado:[],cancelado:[]};
const deliveryStates={asignada:'en_camino',en_camino:'en_destino',en_destino:'entregada'};
const activeDelivery=state=>['asignada','en_camino','en_destino'].includes(state);
const idOk=value=>typeof value==='string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
const textOk=(value,max=500)=>typeof value==='string' && value.length<=max && !/[<>\x00-\x1f]/.test(value);
const integer=(value,max=100000)=>Number.isSafeInteger(value) && value>=0 && value<=max;
const moneyOk=value=>typeof value==='number' && Number.isFinite(value) && value>=0 && value<=100000 && Math.abs(value*100-Math.round(value*100))<0.000001;
const dateOk=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
const imageOk=value=>typeof value==='string' && /^assets\/images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)$/.test(value);
const normalize=value=>String(value || '').normalize('NFD').replace(/\p{M}/gu,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const amount=cents=>Number((cents/100).toFixed(2));
const cents=value=>Math.round(Number(value)*100);
const timestamp=previous=>new Date(Math.max(Date.now(),Date.parse(previous || '')+1 || 0)).toISOString();
const copy=value=>JSON.parse(JSON.stringify(value));
let memory;

class DemoError extends Error {
  constructor(status,message,details=[]){super(message);Object.assign(this,{status,details});}
}
const fail=(status,message,field)=>{throw new DemoError(status,message,field?[{field,message}]:[]);};
function requireRole(user,...roles){if(!user)fail(401,'Elige un rol de la demostración para continuar.');if(!roles.includes(user.role))fail(403,'Este rol de demostración no tiene permiso para esa acción.');}
function tax(value,rate=15){const base=Math.round(value*100/(100+rate));return {ivaPorcentaje:rate,baseImponible:amount(base),ivaMonto:amount(value-base)};}
function restricted(product){return product.requiereReceta || product.controlado || product.biologico || product.cadenaFrio;}
function allowsPromotion(product){return !product.requiereReceta && !product.controlado && !product.biologico;}
function visible(promo,now=Date.now()){return promo.activa && (!promo.inicio || Date.parse(promo.inicio)<=now) && (!promo.fin || Date.parse(promo.fin)>now);}
function priced(state,product){
  const campaigns=state.promotions.filter(p=>p.productoId===product.id && visible(p) && !p.vistaPrevia).sort((a,b)=>b.descuentoPorcentaje-a.descuentoPorcentaje || a.orden-b.orden || a.id.localeCompare(b.id));
  const direct=allowsPromotion(product)?product.descuentoPorcentaje:0;
  const campaign=allowsPromotion(product)?campaigns[0]:null;
  const percentage=Math.max(direct,campaign?.descuentoPorcentaje || 0),original=cents(product.precio),value=Math.round(original*(100-percentage)/100);
  return {...product,precio:amount(value),precioOriginal:amount(original),descuentoDirecto:direct,descuentoPorcentaje:percentage,promocionId:campaign && campaign.descuentoPorcentaje>direct?campaign.id:null,...tax(value,product.ivaCategoria==='cero'?0:15)};
}
function newProduct(values,id,now){return {id,nombre:values.nombre,precio:values.precio,stock:values.stock,categoria:values.categoria,descripcion:values.descripcion,imagen:values.imagen,alt:values.alt,activo:true,createdAt:now,updatedAt:now,stockMinimo:5,descuentoPorcentaje:0,ivaCategoria:'general',fundamentoIva:null,tipoProducto:'cuidado',pvpMaximo:null,codigoInterno:null,codigoBarras:null,laboratorio:null,principioActivo:null,concentracion:null,presentacion:null,registroSanitario:null,requiereReceta:false,controlado:false,biologico:false,cadenaFrio:false};}
function initialState(){
  const now=new Date().toISOString();
  const products=[
    newProduct({nombre:'Vitamina C',precio:7.5,stock:24,categoria:'bienestar',descripcion:'Suplemento ficticio para explorar el catálogo de clase.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase ilustrativo de vitaminas'},'clase-vitamina-c',now),
    newProduct({nombre:'Protector solar',precio:12.5,stock:16,categoria:'cuidado',descripcion:'Protector solar de demostración para cuidado personal.',imagen:'assets/images/producto-solar-eucerin.png',alt:'Presentación ilustrativa de protector solar'},'clase-protector-solar',now),
    newProduct({nombre:'Gel de manos',precio:3.25,stock:17,categoria:'cuidado',descripcion:'Gel de manos ficticio para la compra y entrega de clase.',imagen:'assets/images/producto-gel-antibacterial.svg',alt:'Ilustración de un frasco de gel de manos'},'clase-gel-manos',now),
    newProduct({nombre:'Cuidado bebé',precio:6.5,stock:4,categoria:'bebe',descripcion:'Producto ficticio para el cuidado del bebé en la clase.',imagen:'assets/images/producto-bebe-pigeon.png',alt:'Presentación ilustrativa de cuidado del bebé'},'clase-cuidado-bebe',now),
  ];
  products[0].tipoProducto='suplemento';
  const zone={id:'clase-puerto-quito',nombre:'Puerto Quito · tarifa DEMO',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:150,ivaCategoria:'general',fundamentoIva:null,version:1,activa:true,createdAt:now,updatedAt:now,tarifas:[]};
  const order={id:'clase-pedido-inicial',userId:profiles['clase-user'].id,nombre:'Cliente de clase',email:'cliente@example.invalid',telefono:'0990000000',documento:'••••••0000',entrega:'delivery',provincia:'Pichincha',ciudad:'Puerto Quito',direccion:'Calle de demostración s/n, frente al parque ficticio',codigoPostal:null,zonaEntregaId:zone.id,costoEnvioCentavos:150,subtotalProductos:3.25,total:4.75,baseImponible:4.13,ivaMonto:0.62,envioIvaPorcentaje:15,envioBaseImponible:1.3,envioIvaMonto:0.2,estado:'preparado',createdAt:now,updatedAt:now,detalles:[{id:'clase-detalle-inicial',pedidoId:'clase-pedido-inicial',productoId:products[2].id,nombreProducto:products[2].nombre,cantidad:1,precioUnitario:3.25,precioOriginal:3.25,descuentoPorcentaje:0,totalLinea:3.25,...tax(325)}],historial:['pendiente','confirmado','preparado'].map(estado=>({estado,createdAt:now}))};
  return {version:1,sequence:100,products,promotions:[{id:'clase-bienestar',productoId:products[0].id,titulo:'Bienestar de clase',etiqueta:'DEMO 10 %',descripcion:'Campaña ficticia de la presentación.',descuentoPorcentaje:10,activa:true,vistaPrevia:false,orden:0,inicio:null,fin:null,imagen:null,alt:null,createdAt:now,updatedAt:now}],orders:[order],deliveries:[{id:'clase-entrega-inicial',pedidoId:order.id,repartidorId:profiles['clase-repartidor'].id,estado:'asignada',version:1,gpsVersion:0,asignadaAt:now,salidaAt:null,llegadaAt:null,finalizadaAt:null,ubicacion:null}],zones:[zone],requests:[]};
}

function validState(state){
  if(!state || state.version!==1 || !integer(state.sequence,1000000))return false;
  for(const key of ['products','promotions','orders','deliveries','zones','requests']){
    if(!Array.isArray(state[key]) || state[key].length>LIMIT)return false;
    if(key!=='requests' && (state[key].some(item=>!item || !idOk(item.id)) || new Set(state[key].map(item=>item.id)).size!==state[key].length))return false;
  }
  try{
    for(const product of state.products)validateProduct(product);
    for(const promo of state.promotions)validatePromotion(state,promo);
    if(state.products.some(p=>typeof p.activo!=='boolean' || !dateOk(p.createdAt) || !dateOk(p.updatedAt)))return false;
    if(state.promotions.some(p=>!dateOk(p.createdAt) || !dateOk(p.updatedAt)))return false;
    for(const zone of state.zones){validateZone(zone);if(!integer(zone.version) || zone.version<1 || !Array.isArray(zone.tarifas) || zone.tarifas.length>LIMIT)return false;}
    for(const order of state.orders){
      if(!idOk(order.userId) || !Object.hasOwn(orderStates,order.estado) || !dateOk(order.createdAt) || !dateOk(order.updatedAt) || !moneyOk(order.total) || !moneyOk(order.subtotalProductos) || !integer(order.costoEnvioCentavos,10000000) || !['delivery','pickup'].includes(order.entrega))return false;
      if(!['nombre','email','telefono','documento'].every(key=>textOk(order[key],254)) || !['provincia','ciudad','direccion','codigoPostal'].every(key=>order[key]===null || textOk(order[key],300)))return false;
      if(!Array.isArray(order.detalles) || !order.detalles.length || order.detalles.length>30 || order.detalles.some(line=>!line || !idOk(line.productoId) || !integer(line.cantidad,99) || !line.cantidad || !moneyOk(line.precioUnitario) || !textOk(line.nombreProducto,120)))return false;
      if(!Array.isArray(order.historial) || order.historial.length>10 || order.historial.some(change=>!change || !Object.hasOwn(orderStates,change.estado) || !dateOk(change.createdAt)))return false;
    }
    for(const item of state.deliveries){
      if(!state.orders.some(order=>order.id===item.pedidoId) || item.repartidorId!==profiles['clase-repartidor'].id || !['asignada','en_camino','en_destino','entregada','cancelada'].includes(item.estado) || !integer(item.version) || !item.version || !integer(item.gpsVersion))return false;
      if(!dateOk(item.asignadaAt) || !['salidaAt','llegadaAt','finalizadaAt'].every(key=>item[key]===null || dateOk(item[key])))return false;
      if(item.ubicacion!==null && (!item.ubicacion || item.ubicacion.latitud!==0.12 || item.ubicacion.longitud!==-79.24 || item.ubicacion.precision!==20 || !dateOk(item.ubicacion.registradaAt)))return false;
    }
    if(new Set(state.deliveries.map(item=>item.pedidoId)).size!==state.deliveries.length)return false;
    return state.requests.every(item=>item && idOk(item.userId) && textOk(item.key,100) && /^[a-f0-9]{64}$/.test(item.hash) && state.orders.some(order=>order.id===item.orderId && order.userId===item.userId));
  }catch{return false;}
}
function load(){
  let raw;
  try{raw=globalThis.localStorage?.getItem(CLASSROOM_STATE_KEY);}catch{}
  if(raw!==undefined && raw!==null){try{if(raw.length<=MAX_BYTES){const parsed=JSON.parse(raw);if(validState(parsed))return parsed;}}catch{}return initialState();}
  return memory?copy(memory):initialState();
}
function save(state){
  const value=JSON.stringify(state);if(value.length>MAX_BYTES)fail(409,'La demostración llegó a su límite. Reinicia el recorrido de clase.');
  try{globalThis.localStorage?.setItem(CLASSROOM_STATE_KEY,value);}catch{fail(503,'No se pudo guardar la demostración. Habilita el almacenamiento local del navegador.');}
  memory=copy(state);
}
export function resetClassroom(){const state=initialState();save(state);return copy(state);}
function paginate(items,params){
  const page=Number(params.get('page') || 1),pageSize=Number(params.get('pageSize') || 20);
  if(!Number.isSafeInteger(page) || page<1 || page>10000 || !Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>100)fail(422,'Usa una página válida y hasta 100 registros.');
  return {items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize};
}
const nextId=(state,name)=>`demo${String(++state.sequence).padStart(4,'0')}-${name}`;
function find(items,id){const found=items.find(item=>item.id===id);if(!found)fail(404,'No se encontró ese registro de demostración.');return found;}
function checkVersion(actual,expected){if(actual!==expected)fail(409,'El registro cambió. Actualiza la pantalla antes de guardar.');}
function validateProduct(product){
  for(const [key,max,min] of [['nombre',120,2],['descripcion',500,2],['alt',250,2]])if(!textOk(product[key],max) || product[key].trim().length<min)fail(422,'Completa este texto sin etiquetas.',key);
  if(!moneyOk(product.precio))fail(422,'Escribe un precio válido con hasta dos decimales.','precio');
  if(!integer(product.stock) || !integer(product.stockMinimo))fail(422,'El stock debe ser un entero entre 0 y 100000.','stock');
  if(!integer(product.descuentoPorcentaje,85))fail(422,'Usa un descuento entero entre 0 y 85.','descuentoPorcentaje');
  if(!['bienestar','cuidado','bebe'].includes(product.categoria) || !['cuidado','medicamento','insumo','suplemento'].includes(product.tipoProducto))fail(422,'Selecciona una categoría y un tipo válidos.','categoria');
  if(!imageOk(product.imagen))fail(422,'Usa una imagen local de assets/images/.','imagen');
  if(!['general','cero'].includes(product.ivaCategoria))fail(422,'Selecciona una clasificación de IVA válida.','ivaCategoria');
  if(product.ivaCategoria==='cero' && (!textOk(product.fundamentoIva,300) || product.fundamentoIva.trim().length<8))fail(422,'Registra el fundamento de la clasificación del ejemplo.','fundamentoIva');
  for(const key of ['requiereReceta','controlado','biologico','cadenaFrio'])if(typeof product[key]!=='boolean')fail(422,'Usa una clasificación válida.',key);
  if(!allowsPromotion(product) && product.descuentoPorcentaje>0)fail(422,'Los productos restringidos no admiten promociones.');
  if(product.pvpMaximo!==null && (!moneyOk(product.pvpMaximo) || product.precio>product.pvpMaximo))fail(422,'El precio no puede superar el PVP máximo.','pvpMaximo');
  for(const key of ['codigoInterno','codigoBarras','laboratorio','principioActivo','concentracion','presentacion','registroSanitario','fundamentoIva'])if(product[key]!==null && !textOk(product[key],300))fail(422,'Usa texto válido.',key);
  if(product.tipoProducto==='medicamento' && (!product.pvpMaximo || !product.laboratorio || !product.presentacion || !product.registroSanitario))fail(422,'Completa PVP, laboratorio, presentación y registro del medicamento de ejemplo.');
}
function productValues(body,existing,now,id){
  const value=existing?{...existing}:newProduct(body,id,now);
  const fields=['nombre','precio','stock','categoria','descripcion','imagen','alt','stockMinimo','descuentoPorcentaje','ivaCategoria','fundamentoIva','tipoProducto','pvpMaximo','codigoInterno','codigoBarras','laboratorio','principioActivo','concentracion','presentacion','registroSanitario','requiereReceta','controlado','biologico','cadenaFrio'];
  for(const key of fields)if(Object.hasOwn(body,key))value[key]=body[key];
  validateProduct(value);value.updatedAt=now;return value;
}
function validatePromotion(state,promo){
  const product=state.products.find(item=>item.id===promo.productoId);
  if(!product)fail(422,'Elige un producto del catálogo de clase.','productoId');
  if(!allowsPromotion(product))fail(422,'Este producto requiere revisión y no admite campañas públicas.');
  for(const [key,max] of [['titulo',120],['etiqueta',80],['descripcion',300]])if(!textOk(promo[key],max) || promo[key].trim().length<2)fail(422,'Completa este texto sin etiquetas.',key);
  if(!integer(promo.descuentoPorcentaje,85) || !integer(promo.orden,10000) || typeof promo.activa!=='boolean' || typeof promo.vistaPrevia!=='boolean')fail(422,'Revisa descuento, orden y publicación de la campaña.');
  if((promo.inicio!==null && !dateOk(promo.inicio)) || (promo.fin!==null && !dateOk(promo.fin)) || (promo.inicio && promo.fin && Date.parse(promo.fin)<=Date.parse(promo.inicio)))fail(422,'El fin debe ser posterior al inicio.','fin');
  if(promo.imagen!==null && (!imageOk(promo.imagen) || !textOk(promo.alt,250) || promo.alt.trim().length<2))fail(422,'Usa una imagen local y su descripción.','imagen');
}
function validateZone(zone){
  for(const key of ['nombre','provincia','canton'])if(!textOk(zone[key],120) || zone[key].trim().length<2)fail(422,'Completa la zona de demostración.',key);
  if(zone.tarifaCentavos!==null && !integer(zone.tarifaCentavos,10000000))fail(422,'Usa centavos enteros o deja la tarifa pendiente.','tarifaCentavos');
  if(typeof zone.activa!=='boolean' || !['general','cero'].includes(zone.ivaCategoria))fail(422,'Revisa la configuración de la zona.');
  if(zone.fundamentoIva!==null && !textOk(zone.fundamentoIva,300))fail(422,'Usa texto válido para el fundamento del ejemplo.','fundamentoIva');
  if(zone.ivaCategoria==='cero' && (!textOk(zone.fundamentoIva,300) || zone.fundamentoIva.trim().length<8))fail(422,'Completa el fundamento de IVA del ejemplo.','fundamentoIva');
}
function publicOrder(order){return copy(order);}
function deliveryDto(state,item){
  const order=find(state.orders,item.pedidoId),active=activeDelivery(item.estado);
  const location=active && item.ubicacion && Date.now()-Date.parse(item.ubicacion.registradaAt)<120000?item.ubicacion:null;
  return {...item,ubicacion:location,estadoPedido:order.estado,origenSeguimiento:location?'demo':null,destino:active?{nombre:order.nombre,telefono:order.telefono,provincia:order.provincia,ciudad:order.ciudad,direccion:order.direccion,latitud:null,longitud:null}:null};
}
function ownedDelivery(state,id,user){requireRole(user,'admin','repartidor');const item=find(state.deliveries,id);if(user.role==='repartidor' && item.repartidorId!==user.id)fail(404,'No se encontró una entrega asignada a este rol.');return item;}
function changeOrder(state,order,body){
  if(order.estado===body.estado)return order;
  checkVersion(order.updatedAt,body.esperadoUpdatedAt);
  if(!orderStates[order.estado]?.includes(body.estado))fail(409,'Ese cambio de estado no está permitido. Los estados finales no se reabren.');
  const delivery=state.deliveries.find(item=>item.pedidoId===order.id);
  if(body.estado==='entregado' && order.entrega==='delivery' && delivery?.estado!=='en_destino')fail(409,'El reparto debe estar en destino antes de finalizar.');
  if(body.estado==='cancelado'){
    if(order.detalles.some(line=>find(state.products,line.productoId).stock+line.cantidad>100000))fail(409,'La devolución supera el stock máximo de la demostración. Ajusta el stock antes de cancelar.');
    for(const line of order.detalles){const product=find(state.products,line.productoId);product.stock+=line.cantidad;product.updatedAt=timestamp(product.updatedAt);}
  }
  order.estado=body.estado;order.updatedAt=timestamp(order.updatedAt);order.historial.push({estado:order.estado,createdAt:order.updatedAt});
  if(delivery && ['entregado','cancelado'].includes(order.estado)){delivery.estado=order.estado==='entregado'?'entregada':'cancelada';delivery.version++;delivery.gpsVersion++;delivery.finalizadaAt=order.updatedAt;delivery.ubicacion=null;}
  return order;
}
function summary(state){
  const now=new Date(),orders=state.orders,active=state.products.filter(p=>p.activo),states=Object.keys(orderStates).map(estado=>{const list=orders.filter(order=>order.estado===estado);return {estado,cantidad:list.length,totalCentavos:list.reduce((sum,order)=>sum+cents(order.total),0)};}).filter(value=>value.cantidad);
  const local=new Date(Date.now()-5*3600000),months=Array.from({length:6},(_,index)=>new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()-5+index,1,12)));
  const trend=months.map(date=>{const periodo=date.toISOString().slice(0,7),list=orders.filter(order=>new Date(Date.parse(order.createdAt)-5*3600000).toISOString().startsWith(periodo));return {periodo,etiqueta:new Intl.DateTimeFormat('es-EC',{month:'long',year:'numeric',timeZone:'UTC'}).format(date),cantidad:list.length,totalCentavos:list.reduce((sum,order)=>sum+cents(order.total),0)};});
  const alerts=active.filter(p=>p.stock<=p.stockMinimo).sort((a,b)=>a.stock-b.stock);
  const units=new Map();for(const order of orders.filter(order=>['confirmado','preparado','entregado'].includes(order.estado)))for(const line of order.detalles)units.set(line.productoId,(units.get(line.productoId)||0)+line.cantidad);
  return {generadoEn:now.toISOString(),zonaHoraria:'America/Guayaquil',umbralStock:5,indicadores:{pedidosMes:{cantidad:trend[5].cantidad,totalCentavos:trend[5].totalCentavos},pedidosTotales:{cantidad:orders.length,totalCentavos:orders.reduce((sum,order)=>sum+cents(order.total),0)},pedidosPendientes:orders.filter(order=>order.estado==='pendiente').length,productosActivos:active.length,clientesActivos:1,administradoresActivos:1,stockBajo:alerts.length,campanasVisibles:state.promotions.filter(promo=>visible(promo) && state.products.some(p=>p.id===promo.productoId && p.activo)).length,lotesVencidos:0,lotesPorVencer:0},estados:states,tendencia:trend,alertas:alerts.slice(0,10).map(({id,nombre,stock,stockMinimo})=>({id,nombre,stock,stockMinimo})),recientes:[...orders].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(order=>({id:order.id,nombre:order.nombre,estado:order.estado,createdAt:order.createdAt,totalCentavos:cents(order.total)})),masVendidosPorCategoria:['bienestar','cuidado','bebe'].map(categoria=>({categoria,productos:state.products.filter(p=>p.categoria===categoria && units.has(p.id)).map(p=>({id:p.id,nombre:p.nombre,unidadesVendidas:units.get(p.id)})).sort((a,b)=>b.unidadesVendidas-a.unidadesVendidas).slice(0,3)}))};
}
function createOrder(state,user,body,hash){
  requireRole(user,'user');
  if(!textOk(body.claveSolicitud,100) || body.claveSolicitud.length<1)fail(422,'La confirmación necesita una clave de solicitud válida.');
  const prior=state.requests.find(item=>item.userId===user.id && item.key===body.claveSolicitud);
  if(prior){if(prior.hash!==hash)fail(409,'Esta confirmación ya se usó para otro pedido.');return {order:find(state.orders,prior.orderId),status:200};}
  if(state.orders.length>=LIMIT)fail(409,'Reinicia la demostración para empezar otro recorrido.');
  if(!Array.isArray(body.carrito) || !body.carrito.length || body.carrito.length>30 || new Set(body.carrito.map(line=>line?.productoId)).size!==body.carrito.length)fail(422,'Usa un carrito con productos distintos y hasta 30 líneas.');
  const buyer=body.comprador;if(!buyer || !['pickup','delivery'].includes(buyer.delivery))fail(422,'Selecciona retiro o entrega.','delivery');
  let shipping=0,zone=null;
  if(buyer.delivery==='delivery'){
    zone=state.zones.find(item=>item.id===buyer.zonaEntregaId && item.activa);
    if(!zone || normalize(zone.provincia)!==normalize(buyer.province) || normalize(zone.canton)!==normalize(buyer.city))fail(409,'Selecciona una zona de demostración que corresponda a provincia y cantón.');
    checkVersion(zone.version,buyer.esperadoTarifaVersion);if(zone.tarifaCentavos===null)fail(409,'La tarifa de entrega de demostración todavía está pendiente.');shipping=zone.tarifaCentavos;
  }
  const now=new Date().toISOString(),id=nextId(state,'pedido');let total=0,base=0,iva=0;
  const details=body.carrito.map(line=>{
    if(!line || !idOk(line.productoId) || !integer(line.cantidad,99) || !line.cantidad)fail(422,'Usa cantidades enteras de 1 a 99.');
    const product=state.products.find(item=>item.id===line.productoId && item.activo);
    if(!product || product.stock<line.cantidad)fail(409,'Un producto ya no está disponible en la cantidad solicitada.');
    if(restricted(product))fail(409,'Este producto requiere revisión profesional y no admite compra automática.');
    const price=priced(state,product),value=cents(price.precio)*line.cantidad,taxes=tax(value,price.ivaPorcentaje);
    total+=value;base+=cents(taxes.baseImponible);iva+=cents(taxes.ivaMonto);
    return {id:nextId(state,'detalle'),pedidoId:id,productoId:product.id,nombreProducto:product.nombre,cantidad:line.cantidad,precioUnitario:price.precio,precioOriginal:price.precioOriginal,descuentoPorcentaje:price.descuentoPorcentaje,totalLinea:amount(value),...taxes};
  });
  const shippingTax=tax(shipping,zone?.ivaCategoria==='cero'?0:15);
  if(total+shipping>10000000)fail(422,'El total supera el máximo de la demostración.');
  // Personal form values are deliberately discarded; only this fictitious destination is stored.
  const order={id,userId:user.id,nombre:profiles['clase-user'].nombre,email:profiles['clase-user'].email,telefono:profiles['clase-user'].telefono,documento:'••••••0000',entrega:buyer.delivery,provincia:zone?.provincia || null,ciudad:zone?.canton || null,direccion:zone?'Calle de demostración s/n, frente al parque ficticio':null,codigoPostal:null,zonaEntregaId:zone?.id || null,costoEnvioCentavos:shipping,subtotalProductos:amount(total),total:amount(total+shipping),baseImponible:amount(base+cents(shippingTax.baseImponible)),ivaMonto:amount(iva+cents(shippingTax.ivaMonto)),envioIvaPorcentaje:zone?shippingTax.ivaPorcentaje:null,envioBaseImponible:zone?shippingTax.baseImponible:null,envioIvaMonto:zone?shippingTax.ivaMonto:null,estado:'pendiente',createdAt:now,updatedAt:now,detalles:details,historial:[{estado:'pendiente',createdAt:now}]};
  for(const line of details){const product=find(state.products,line.productoId);product.stock-=line.cantidad;product.updatedAt=timestamp(product.updatedAt);}
  state.orders.unshift(order);state.requests.push({userId:user.id,key:body.claveSolicitud,hash,orderId:id});return {order,status:201};
}

function dispatch(state,path,params,method,body,user,hash){
  if(path==='/pagos/configuracion' && method==='GET')return {data:{payphone:{disponible:false,entorno:null},demostracion:true,moneda:'USD'}};
  let match;
  if(path==='/auth/me' && method==='GET'){requireRole(user,'user','admin','repartidor');return {data:user};}
  if(path==='/auth/logout' && method==='POST')return {status:204};
  if(path==='/productos' && method==='GET'){
    const q=normalize(params.get('q')),category=params.get('categoria');
    return {data:paginate(state.products.filter(p=>p.activo && (!category || p.categoria===category) && (!q || normalize(p.nombre+' '+p.descripcion).includes(q))).map(p=>priced(state,p)),params)};
  }
  if((match=path.match(/^\/productos\/([a-z0-9-]+)$/)) && method==='GET'){const product=find(state.products,match[1]);if(!product.activo)fail(404,'El producto no está disponible.');return {data:priced(state,product)};}
  if(path==='/promociones' && method==='GET')return {data:state.promotions.filter(p=>visible(p) && state.products.some(product=>product.id===p.productoId && product.activo && allowsPromotion(product))).sort((a,b)=>a.orden-b.orden).map(p=>({...p,producto:priced(state,find(state.products,p.productoId))}))};
  if(path==='/zonas-entrega' && method==='GET')return {data:state.zones.filter(zone=>zone.activa).map(({tarifas,...zone})=>zone)};
  if(path==='/admin/resumen' && method==='GET'){requireRole(user,'admin');return {data:summary(state)};}
  if(path==='/admin/tablas' && method==='GET'){
    requireRole(user,'admin');const table=params.get('tabla'),tables={productos:state.products,promociones:state.promotions,pedidos:state.orders};
    if(!Object.hasOwn(tables,table))fail(404,'Esa tabla no forma parte de la clase.');return {data:paginate(tables[table],params)};
  }
  if(path==='/productos' && method==='POST'){
    requireRole(user,'admin');if(state.products.length>=LIMIT)fail(409,'Reinicia la demostración para crear más productos.');const product=productValues(body,null,new Date().toISOString(),nextId(state,'producto'));state.products.push(product);return {data:product,status:201};
  }
  if((match=path.match(/^\/productos\/([a-z0-9-]+)$/)) && ['PUT','DELETE'].includes(method)){
    requireRole(user,'admin');const product=find(state.products,match[1]);if(!product.activo)fail(404,'El producto no está disponible.');
    if(method==='DELETE'){product.activo=false;product.updatedAt=timestamp(product.updatedAt);return {status:204};}
    checkVersion(product.updatedAt,body.esperadoUpdatedAt);const value=productValues(body,product,timestamp(product.updatedAt));
    if(!allowsPromotion(value) && state.promotions.some(p=>p.productoId===product.id))fail(409,'Retira las campañas antes de restringir este producto.');Object.assign(product,value);return {data:product};
  }
  if(path==='/promociones' && method==='POST'){
    requireRole(user,'admin');if(state.promotions.length>=LIMIT)fail(409,'Reinicia la demostración para crear más campañas.');
    const now=new Date().toISOString(),promo={id:nextId(state,'promocion'),productoId:body.productoId,titulo:body.titulo,etiqueta:body.etiqueta,descripcion:body.descripcion,descuentoPorcentaje:body.descuentoPorcentaje??0,orden:body.orden??0,activa:body.activa??true,vistaPrevia:body.vistaPrevia??false,inicio:body.inicio || null,fin:body.fin || null,imagen:body.imagen || null,alt:body.alt || null,createdAt:now,updatedAt:now};validatePromotion(state,promo);state.promotions.push(promo);return {data:promo,status:201};
  }
  if((match=path.match(/^\/promociones\/([a-z0-9-]+)$/)) && ['PUT','DELETE'].includes(method)){
    requireRole(user,'admin');const promo=find(state.promotions,match[1]);
    if(method==='DELETE'){state.promotions=state.promotions.filter(item=>item!==promo);return {status:204};}
    const value={...promo};for(const key of ['productoId','titulo','etiqueta','descripcion','descuentoPorcentaje','orden','activa','vistaPrevia','inicio','fin','imagen','alt'])if(Object.hasOwn(body,key))value[key]=body[key] || (['inicio','fin','imagen','alt'].includes(key)?null:body[key]);validatePromotion(state,value);value.updatedAt=timestamp(promo.updatedAt);Object.assign(promo,value);return {data:promo};
  }
  if(path==='/pedidos' && method==='POST'){const result=createOrder(state,user,body,hash);return {data:publicOrder(result.order),status:result.status};}
  if(path==='/pedidos/mis-pedidos' && method==='GET'){requireRole(user,'user');return {data:paginate(state.orders.filter(order=>order.userId===user.id).map(publicOrder),params)};}
  if(path==='/pedidos' && method==='GET'){requireRole(user,'admin');return {data:paginate(state.orders.map(publicOrder),params)};}
  if((match=path.match(/^\/pedidos\/([a-z0-9-]+)\/estado$/)) && method==='PUT'){requireRole(user,'admin');return {data:publicOrder(changeOrder(state,find(state.orders,match[1]),body))};}
  if(path==='/admin/zonas-entrega' && method==='GET'){requireRole(user,'admin');return {data:state.zones};}
  if((match=path.match(/^\/admin\/zonas-entrega\/([a-z0-9-]+)$/)) && method==='PUT'){
    requireRole(user,'admin');const zone=find(state.zones,match[1]);checkVersion(zone.version,body.esperadoVersion);const value={...zone};for(const key of ['nombre','provincia','canton','tarifaCentavos','ivaCategoria','fundamentoIva','activa'])if(Object.hasOwn(body,key))value[key]=body[key];validateZone(value);value.version++;value.updatedAt=timestamp(zone.updatedAt);value.tarifas=[{version:value.version,tarifaCentavos:value.tarifaCentavos,createdAt:value.updatedAt},...zone.tarifas].slice(0,LIMIT);Object.assign(zone,value);return {data:zone};
  }
  if(path==='/admin/repartidores' && method==='GET'){requireRole(user,'admin');return {data:[profiles['clase-repartidor']]};}
  if(path==='/entregas' && method==='GET'){
    requireRole(user,'admin','repartidor');const estado=params.get('estado');return {data:paginate(state.deliveries.filter(item=>(user.role==='admin' || item.repartidorId===user.id) && (!estado || item.estado===estado)).map(item=>deliveryDto(state,item)),params)};
  }
  if(path==='/entregas/asignar' && method==='POST'){
    requireRole(user,'admin');const order=find(state.orders,body.pedidoId);if(order.entrega!=='delivery' || !['confirmado','preparado'].includes(order.estado))fail(409,'Solo puedes asignar pedidos a domicilio confirmados o preparados.');if(body.repartidorId!==profiles['clase-repartidor'].id)fail(422,'Elige el repartidor de clase.');
    let delivery=state.deliveries.find(item=>item.pedidoId===order.id);
    if(delivery){if(delivery.estado!=='asignada')fail(409,'La entrega ya inició.');if(body.esperadoVersion!==undefined)checkVersion(delivery.version,body.esperadoVersion);return {data:deliveryDto(state,delivery)};}
    if(body.esperadoVersion!=null)fail(409,'La entrega todavía no tiene esa versión.');if(state.deliveries.length>=LIMIT)fail(409,'Reinicia el recorrido para crear más entregas.');
    delivery={id:nextId(state,'entrega'),pedidoId:order.id,repartidorId:body.repartidorId,estado:'asignada',version:1,gpsVersion:0,asignadaAt:new Date().toISOString(),salidaAt:null,llegadaAt:null,finalizadaAt:null,ubicacion:null};state.deliveries.push(delivery);return {data:deliveryDto(state,delivery)};
  }
  if((match=path.match(/^\/entregas\/([a-z0-9-]+)\/estado$/)) && method==='PUT'){
    const item=ownedDelivery(state,match[1],user);if(item.estado===body.estado)return {data:deliveryDto(state,item)};checkVersion(item.version,body.esperadoVersion);
    if(body.estado==='cancelada' ? user.role!=='admin' || !activeDelivery(item.estado) : deliveryStates[item.estado]!==body.estado)fail(409,'Ese cambio de entrega no está permitido.');
    const order=find(state.orders,item.pedidoId);if(body.estado==='en_camino' && order.estado!=='preparado')fail(409,'Prepara el pedido antes de marcar la salida.');
    if(['entregada','cancelada'].includes(body.estado))changeOrder(state,order,{estado:body.estado==='entregada'?'entregado':'cancelado',esperadoUpdatedAt:order.updatedAt});
    else{item.estado=body.estado;item.version++;item[body.estado==='en_camino'?'salidaAt':'llegadaAt']=new Date().toISOString();}
    return {data:deliveryDto(state,item)};
  }
  if((match=path.match(/^\/entregas\/([a-z0-9-]+)\/ubicacion$/)) && ['PUT','DELETE'].includes(method)){
    requireRole(user,'repartidor');const item=ownedDelivery(state,match[1],user);
    if(method==='DELETE'){item.ubicacion=null;item.gpsVersion++;return {data:{gpsVersion:item.gpsVersion,ubicacion:null}};}
    if(!['en_camino','en_destino'].includes(item.estado))fail(409,'Inicia el recorrido antes de simular una ubicación.');checkVersion(item.gpsVersion,body.esperadoGpsVersion);
    item.ubicacion={latitud:0.12,longitud:-79.24,precision:20,registradaAt:new Date().toISOString()};item.gpsVersion++;return {data:{gpsVersion:item.gpsVersion,ubicacion:item.ubicacion}};
  }
  if((match=path.match(/^\/pedidos\/([a-z0-9-]+)\/seguimiento$/)) && method==='GET'){
    requireRole(user,'user','admin');const order=find(state.orders,match[1]);if(user.role!=='admin' && order.userId!==user.id)fail(404,'No se encontró un pedido de este cliente.');const item=state.deliveries.find(item=>item.pedidoId===order.id),dto=item?deliveryDto(state,item):null;
    return {data:{pedidoId:order.id,estadoPedido:order.estado,entrega:dto?{id:dto.id,estado:dto.estado,version:dto.version,asignadaAt:dto.asignadaAt,salidaAt:dto.salidaAt,llegadaAt:dto.llegadaAt,finalizadaAt:dto.finalizadaAt,ubicacion:dto.ubicacion}:null}};
  }
  if((match=path.match(/^\/pedidos\/([a-z0-9-]+)\/pago$/)) && method==='GET'){
    requireRole(user,'user','admin');const order=find(state.orders,match[1]);if(user.role!=='admin' && order.userId!==user.id)fail(404,'No se encontró un pedido de este cliente.');
    return {data:{pedido:{...publicOrder(order),totalCentavos:cents(order.total),subtotalCentavos:cents(order.subtotalProductos),ivaCentavos:cents(order.ivaMonto),moneda:'USD',detalles:order.detalles.map(line=>({...line,totalCentavos:cents(line.totalLinea)}))},pago:null,payphone:{disponible:false,entorno:null},demostracion:true}};
  }
  fail(404,'Esta función no forma parte de la demostración de clase.');
}

function response(data,status=200){return new Response(status===204?null:JSON.stringify({ok:true,data}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Farmacia-Classroom':'true'}});}
/** Always handles the request locally, including unsupported routes. Never falls back to HTTP. */
export async function classroomResponse(path,{method='GET',headers={},body,signal}={}){
  if(signal?.aborted)throw signal.reason || new DOMException('Solicitud cancelada.','AbortError');
  try{
    if(typeof path!=='string' || !path.startsWith('/') || path.startsWith('//') || /[\\#\r\n]/.test(path) || path.length>2000)fail(404,'Ruta de demostración no disponible.');
    const authorization=new Headers(headers).get('Authorization'),token=authorization?.match(/^Bearer (clase-(?:user|admin|repartidor))$/)?.[1];
    const user=token?profiles[token]:null;if(authorization && !user)fail(401,'Usa únicamente los roles ficticios de la demostración.');
    let input={};if(body!==undefined){if(typeof body==='string'){if(body.length>50000)fail(413,'La solicitud de demostración es demasiado grande.');try{input=JSON.parse(body);}catch{fail(400,'La solicitud no contiene JSON válido.');}}else input=body;if(!input || typeof input!=='object' || Array.isArray(input))fail(422,'La solicitud debe contener un objeto.');}
    const url=new URL(path,'https://classroom.invalid');method=String(method).toUpperCase();
    let hash;
    if(url.pathname==='/pedidos' && method==='POST'){
      const signature=JSON.stringify({carrito:Array.isArray(input.carrito)?[...input.carrito].sort((a,b)=>String(a?.productoId).localeCompare(String(b?.productoId))):input.carrito,comprador:input.comprador && Object.fromEntries(Object.entries(input.comprador).sort())});
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature));hash=[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
    }
    if(signal?.aborted)throw signal.reason || new DOMException('Solicitud cancelada.','AbortError');
    // Read only after async fingerprinting, then validate, mutate and save without yielding.
    const state=load(),result=dispatch(state,url.pathname,url.searchParams,method,input,user,hash);save(state);return response(result.data,result.status);
  }catch(error){
    if(signal?.aborted)throw signal.reason || error;
    if(!(error instanceof DemoError))throw error;
    return new Response(JSON.stringify({ok:false,error:{message:error.message,details:error.details}}),{status:error.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Farmacia-Classroom':'true'}});
  }
}
