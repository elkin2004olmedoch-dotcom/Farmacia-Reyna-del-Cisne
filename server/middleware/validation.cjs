const {body,param,query,validationResult,matchedData} = require('express-validator');
const {AppError} = require('./errors.cjs');
const fs=require('node:fs');
const path=require('node:path');
const ec = require('../../frontend/models/ecuador.js');
const plain = value => typeof value==='string' ? value.normalize('NFC').replace(/<[^>]*>/g,'').replace(/[<>\x00-\x1f]/g,'').trim() : value;
const text = (field,min,max) => body(field).isString().bail().customSanitizer(plain).isLength({min,max});
const id = param('id').isString().matches(/^[a-z0-9][a-z0-9-]{0,79}$/);
function validated(req,res,next) {
  const errors=validationResult(req);
  if (!errors.isEmpty()) throw new AppError(422,'VALIDATION_ERROR','Revisa los datos de la solicitud.',errors.array({onlyFirstError:true}).map(error=>({field:error.path,message:error.msg})));
  req.input=matchedData(req,{includeOptionals:false});next();
}
const only = fields => (req,res,next)=> {
  if (!req.body || typeof req.body!=='object' || Array.isArray(req.body) || Object.keys(req.body).some(key=>!fields.includes(key))) throw new AppError(422,'UNEXPECTED_FIELDS','La solicitud contiene campos no permitidos.');
  next();
};
const password=body('password').isString().bail().custom(value=>Buffer.byteLength(value,'utf8')<=72 && value.length>=10 && /\p{L}/u.test(value) && /\d/.test(value)).withMessage('Usa al menos 10 caracteres, una letra y un número; máximo 72 bytes.');
const register=[only(['nombre','email','telefono','cedula','password']),text('nombre',2,80).custom(ec.validName),body('email').isString().bail().trim().toLowerCase().custom(ec.validEmail),body('telefono').isString().bail().custom(ec.normalizePhone).customSanitizer(ec.normalizePhone),body('cedula').isString().bail().trim().custom(ec.validCedula),password,validated];
const login=[only(['email','password']),body('email').isString().bail().trim().toLowerCase().custom(ec.validEmail),body('password').isString().bail().isLength({min:1,max:128}).custom(value=>Buffer.byteLength(value,'utf8')<=72),validated];
const pagination=[query('page').optional().isInt({min:1,max:100000}).toInt(),query('pageSize').optional().isInt({min:1,max:100}).toInt(),validated,(req,res,next)=>{req.input={page:1,pageSize:50,...req.input};next();}];
const catalog=[query('q').optional().isString().bail().customSanitizer(plain).isLength({max:100}),query('categoria').optional().isIn(['bienestar','cuidado','bebe']),...pagination];
const productFields=['nombre','precio','stock','categoria','descripcion','imagen','alt'];
const product=[only(productFields),text('nombre',2,120),body('precio').isFloat({min:0,max:100000}).bail().custom(value=>typeof value==='number' && Math.abs(value*100-Math.round(value*100))<1e-8).withMessage('El precio debe ser un número con máximo dos decimales.'),body('stock').isInt({min:0,max:100000}).bail().custom(value=>typeof value==='number').toInt(),body('categoria').isIn(['bienestar','cuidado','bebe']),text('descripcion',2,500),body('imagen').isString().bail().matches(/^assets\/images\/[a-z0-9-]+\.(jpg|png|webp|svg)$/).bail().custom(value=>fs.existsSync(path.join(__dirname,'../../frontend',value))).withMessage('Selecciona una imagen existente del proyecto.'),text('alt',2,250)];
const order=[only(['carrito','comprador','claveSolicitud']),body('claveSolicitud').isUUID(),body('carrito').isArray({min:1,max:50}).bail().custom(items=>items.every(item=>item && !Array.isArray(item) && Object.keys(item).every(k=>['productoId','cantidad'].includes(k))) && new Set(items.map(item=>item.productoId)).size===items.length).withMessage('El carrito contiene duplicados o campos no permitidos.'),body('carrito.*.productoId').isString().matches(/^[a-z0-9][a-z0-9-]{0,79}$/),body('carrito.*.cantidad').isInt({min:1,max:99}).bail().custom(value=>typeof value==='number'),body('comprador').isObject({strict:true}).bail().custom(value=>Object.keys(value).every(key=>['name','email','phone','documentType','document','delivery','province','city','address','postalCode'].includes(key))).customSanitizer(value=>Object.fromEntries(Object.entries(value).map(([key,val])=>[key,plain(val)]))).custom(value=> {if(Object.values(value).some(v=>typeof v!=='string'))return false;const errors=ec.validateCheckout(value);if(Object.keys(errors).length)throw new Error(Object.values(errors).join(' '));return true;}),validated];
const promotionFields=['titulo','descripcion','etiqueta','productoId','activa','vistaPrevia','orden','inicio','fin'];
const promotion=[only(promotionFields),text('titulo',2,120),text('descripcion',2,300),text('etiqueta',2,80),body('productoId').isString().matches(/^[a-z0-9][a-z0-9-]{0,79}$/),body('activa').isBoolean({strict:true}),body('vistaPrevia').isBoolean({strict:true}),body('orden').isInt({min:0,max:10000}).bail().custom(v=>typeof v==='number'),body('inicio').optional({values:'null'}).isISO8601({strict:true}).bail().matches(/(?:Z|[+-]\d{2}:\d{2})$/),body('fin').optional({values:'null'}).isISO8601({strict:true}).bail().matches(/(?:Z|[+-]\d{2}:\d{2})$/),body('fin').custom((value,{req})=>!value || !req.body.inicio || Date.parse(value)>Date.parse(req.body.inicio)).withMessage('El fin debe ser posterior al inicio.')];
module.exports={register,login,id,pagination,catalog,product,productFields,order,promotion,validated,plain};
