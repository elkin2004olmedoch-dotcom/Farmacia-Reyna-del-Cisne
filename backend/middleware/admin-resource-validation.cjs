const {query,param}=require('express-validator');
const resources=require('../models/admin-resources.cjs');
const {AppError}=require('./errors.cjs');
const selection=rule=>rule.isString().bail().custom(value=>Boolean(resources.find(value))).withMessage('Selecciona un recurso administrativo válido.').bail().customSanitizer(value=>resources.find(value).key);
const tableQuery=(req,res,next)=>{
 const allowed=['tabla','page','pageSize'];
 if(resources.find(req.query.tabla)?.key==='productos')allowed.push('q');
 if(Object.entries(req.query).some(([key,value])=>!allowed.includes(key)||typeof value!=='string'))throw new AppError(422,'INVALID_QUERY','Usa filtros y paginación administrativos válidos.');
 next();
};
module.exports={tableQuery,productName:query('q').optional().isString().bail().trim().isLength({max:120}),table:selection(query('tabla')),resource:selection(param('tabla'))};
