'use strict';
const {body,validationResult,matchedData}=require('express-validator');
const V=require('./validation.cjs');
const {AppError}=require('./errors.cjs');
const suppliers=require('../models/proveedores.cjs');
const promotions=require('../models/promociones.cjs');

function validBody(req,fields){
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(field=>!fields.includes(field)))throw new AppError(422,'UNEXPECTED_FIELDS','La solicitud contiene campos no permitidos.');
}
async function version(req,optional=false){
 const input={body:req.body};
 let rule=body('esperadoUpdatedAt');
 if(optional)rule=rule.optional();
 await rule.isString().bail()
  .isISO8601({strict:true,strictSeparator:true}).bail()
  .matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/).run(input);
 if(!validationResult(input).isEmpty())throw new AppError(422,'VALIDATION_ERROR','Usa la versión del registro en formato ISO con zona horaria.');
 return req.body?.esperadoUpdatedAt;
}
function patch(model,fields,rules){
 return async(req,res,next)=>{
  validBody(req,[...fields,'esperadoUpdatedAt']);
  const expected=await version(req),provided=Object.keys(req.body).filter(field=>field!=='esperadoUpdatedAt');
  if(!provided.length)throw new AppError(422,'EMPTY_UPDATE','Incluye al menos un campo para actualizar.');
  const current=await model.find(req.params.id);
  if(!current)throw new AppError(404,'NOT_FOUND','No se encontró el registro.');
  const values=Object.fromEntries(fields.filter(field=>field in current).map(field=>[field,current[field] instanceof Date?current[field].toISOString():current[field]]));
  const input={body:{...values,...Object.fromEntries(provided.map(field=>[field,req.body[field]]))},params:{},query:{}};
  // Reuse the full-record validators so cross-field rules also see saved values.
  for(const rule of rules.slice(1))await rule.run(input);
  V.validated(input,res,()=>{});
  const normalized=matchedData(input,{includeOptionals:true});
  req.input={id:req.params.id,esperadoUpdatedAt:expected,...Object.fromEntries(provided.map(field=>[field,normalized[field]]))};
  next();
 };
}
module.exports={
 supplierPatch:[V.id,V.validated,patch(suppliers,V.supplierFields,V.supplier)],
 promotionPatch:[V.id,V.validated,patch(promotions,V.promotionFields,V.promotion)],
 versionOnly:[V.id,V.validated,async(req,res,next)=>{
  validBody(req,['esperadoUpdatedAt']);
  req.input={id:req.params.id,esperadoUpdatedAt:await version(req)};
  next();
 }],
 versionOptional:[async(req,res,next)=>{
  req.resourceVersion=await version(req,true);
  if(req.body&&Object.hasOwn(req.body,'esperadoUpdatedAt')){const {esperadoUpdatedAt,...values}=req.body;req.body=values;}
  next();
 }],
};
