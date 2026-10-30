const {body,query}=require('express-validator');
const {AppError}=require('./errors.cjs');
const V=require('./validation.cjs');
const ec=require('../../frontend/models/ecuador.js');
const only=fields=>(req,res,next)=>{if(!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Object.keys(req.body).some(k=>!fields.includes(k)))throw new AppError(422,'UNEXPECTED_FIELDS','La solicitud contiene campos no permitidos.');next();};
const text=(key,min,max)=>body(key).isString().bail().customSanitizer(V.plain).isLength({min,max});
const id=key=>body(key).isString().matches(/^[a-z0-9][a-z0-9-]{0,79}$/);
const integer=(key,min=1)=>body(key).custom(v=>Number.isSafeInteger(v)&&v>=min&&v<=2147483647);
const finite=(key,min,max)=>body(key).custom(v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max);
const zoneFields=['nombre','provincia','canton','tarifaCentavos','ivaCategoria','fundamentoIva','activa'];
const zoneRules=[text('nombre',2,120),text('provincia',2,80),text('canton',2,80),body('tarifaCentavos').custom(v=>v===null||Number.isInteger(v)&&v>=0&&v<=10000000),body('ivaCategoria').isIn(['general','cero']),body('fundamentoIva').custom(v=>v===null||typeof v==='string'&&v.trim().length>=8&&v.trim().length<=300).customSanitizer(V.plain),body('fundamentoIva').custom((v,{req})=>req.body.ivaCategoria!=='cero'||typeof v==='string'&&v.length>=8),body('activa').custom(v=>typeof v==='boolean')];
const zone=[only(zoneFields),...zoneRules,V.validated];
const zoneUpdate=[only([...zoneFields,'esperadoVersion']),...zoneRules,integer('esperadoVersion'),V.validated];
const driver=[only(['nombre','email','telefono','password']),text('nombre',2,80).custom(ec.validName),body('email').isString().bail().trim().toLowerCase().custom(ec.validEmail),body('telefono').isString().bail().custom(ec.normalizePhone).customSanitizer(ec.normalizePhone),body('password').isString().bail().custom(v=>Buffer.byteLength(v,'utf8')<=72&&v.length>=10&&/\p{L}/u.test(v)&&/\d/.test(v)),V.validated];
const driverActive=[only(['activo']),body('activo').custom(v=>typeof v==='boolean'),V.validated];
const assign=[only(['pedidoId','repartidorId','esperadoVersion']),id('pedidoId'),id('repartidorId'),integer('esperadoVersion').optional(),V.validated];
const state=[only(['estado','esperadoVersion']),body('estado').isIn(['en_camino','en_destino','entregada','cancelada']),integer('esperadoVersion'),V.validated];
const location=[only(['latitud','longitud','precision','registradaAt','esperadoGpsVersion']),finite('latitud',-90,90),finite('longitud',-180,180),finite('precision',0,10000),body('registradaAt').isString().bail().isISO8601({strict:true,strictSeparator:true}).bail().matches(/(?:Z|[+-]\d{2}:\d{2})$/),integer('esperadoGpsVersion',0),V.validated];
const list=[query('estado').optional().isIn(['asignada','en_camino','en_destino','entregada','cancelada']),...V.pagination];
function validateBuyerDelivery(value){
 const original=['name','email','phone','documentType','document','delivery','province','city','address','postalCode'];
 if(Object.entries(value).some(([key,v])=>original.includes(key)&&typeof v!=='string'))return false;
 const errors=ec.validateCheckout(value);if(Object.keys(errors).length)throw new Error(Object.values(errors).join(' '));
 const hasCoords=value.latitudEntrega!==undefined||value.longitudEntrega!==undefined;
 if(value.consienteUbicacion!==undefined&&typeof value.consienteUbicacion!=='boolean')return false;
 if(value.delivery==='delivery'){
  if(typeof value.zonaEntregaId!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.zonaEntregaId))throw new Error('Selecciona una zona de entrega.');
  if(!Number.isSafeInteger(value.esperadoTarifaVersion)||value.esperadoTarifaVersion<1||value.esperadoTarifaVersion>2147483647)throw new Error('Confirma una tarifa de entrega vigente.');
 }else if(value.zonaEntregaId!==undefined||value.esperadoTarifaVersion!==undefined||hasCoords||value.consienteUbicacion===true)return false;
 if(hasCoords&&!(value.consienteUbicacion===true&&typeof value.latitudEntrega==='number'&&Number.isFinite(value.latitudEntrega)&&Math.abs(value.latitudEntrega)<=90&&typeof value.longitudEntrega==='number'&&Number.isFinite(value.longitudEntrega)&&Math.abs(value.longitudEntrega)<=180))throw new Error('Comparte coordenadas válidas únicamente con tu autorización expresa.');
 return true;
}
module.exports={zone,zoneUpdate,driver,driverActive,assign,state,location,list,validateBuyerDelivery};
