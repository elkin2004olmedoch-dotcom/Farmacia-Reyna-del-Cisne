const {query,param}=require('express-validator');
const resources=require('../models/admin-resources.cjs');
const {AppError}=require('./errors.cjs');
const selection=rule=>rule.isString().bail().custom(value=>Boolean(resources.find(value))).withMessage('Selecciona un recurso administrativo válido.').bail().customSanitizer(value=>resources.find(value).key);
const tableQuery=(req,res,next)=>{
 if(Object.entries(req.query).some(([key,value])=>!['tabla','page','pageSize'].includes(key)||typeof value!=='string'))throw new AppError(422,'INVALID_QUERY','Usa filtros y paginación administrativos válidos.');
 next();
};
module.exports={tableQuery,table:selection(query('tabla')),resource:selection(param('tabla'))};
