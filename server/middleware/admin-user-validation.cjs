const {body}=require('express-validator');
const {AppError}=require('./errors.cjs');
const {plain,validated}=require('./validation.cjs');
const ec=require('../../frontend/models/ecuador.js');
const fields=['nombre','username','email','telefono','role','activo','password'];
const only=allowed=>(req,res,next)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(key=>!allowed.includes(key)))throw new AppError(422,'UNEXPECTED_FIELDS','La solicitud contiene campos no permitidos.');
 next();
};
const rules=()=>[
 body('nombre').isString().bail().customSanitizer(plain).custom(ec.validName).withMessage('Usa un nombre de 2 a 80 caracteres.'),
 body('username').optional().custom(value=>value===null||ec.normalizeUsername(value)!==null).withMessage('Usa entre 3 y 40 letras, números, puntos, guiones o guiones bajos, empezando por una letra.').bail().customSanitizer(value=>value===null?null:ec.normalizeUsername(value)),
 body('email').isString().bail().trim().toLowerCase().custom(ec.validEmail),
 body('telefono').isString().bail().custom(ec.normalizePhone).customSanitizer(ec.normalizePhone),
 body('role').isString().bail().isIn(['user','admin','repartidor']),
 body('activo').isBoolean({strict:true}),
];
const password=()=>body('password').isString().bail().custom(value=>value.length>=10&&Buffer.byteLength(value)<=72&&/\p{L}/u.test(value)&&/\d/.test(value)).withMessage('Usa al menos 10 caracteres, letra y número, y un máximo de 72 bytes.');
const version=()=>body('esperadoUpdatedAt').isString().bail().isISO8601({strict:true,strictSeparator:true}).bail().matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/).withMessage('Usa la versión vigente del usuario.');
const create=[only(fields),...rules(),password(),validated];
const update=[only([...fields,'esperadoUpdatedAt']),...rules(),password().optional(),version(),validated];
const patch=[only([...fields,'esperadoUpdatedAt']),(req,res,next)=>{if(!Object.keys(req.body).some(key=>fields.includes(key)))throw new AppError(422,'EMPTY_PATCH','Cambia al menos un campo del usuario.');next();},...rules().map(rule=>rule.optional()),password().optional(),version(),validated];
const remove=[only(['esperadoUpdatedAt']),version(),validated];
module.exports={create,update,patch,remove};
