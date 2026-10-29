const {Router}=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticate,roles}=require('../middleware/auth.cjs');
const {AppError}=require('../middleware/errors.cjs');
const V=require('../middleware/validation.cjs');
const controller=require('../controllers/pagos.cjs');
module.exports=config=>{
 const router=Router(),auth=authenticate(config),buyer=roles('user','admin');
 const limit=()=>rateLimit({windowMs:60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,handler:(req,res,next)=>next(new AppError(429,'PAYMENT_RATE_LIMIT','Espera un minuto antes de consultar el pago nuevamente.'))});
 router.get('/pagos/configuracion',controller.configuration);
 router.get('/pedidos/:id/pago',auth,buyer,V.id,V.validated,controller.find);
 router.post('/pedidos/:id/pago/payphone',auth,buyer,limit(),V.id,V.validated,(req,res,next)=>{
  if(req.body!==undefined && (!req.body || typeof req.body!=='object' || Array.isArray(req.body) || Object.keys(req.body).length))throw new AppError(422,'UNEXPECTED_FIELDS','El pago no acepta importes ni datos de tarjeta.');next();
 },controller.start);
 router.get('/pagos/payphone/respuesta',limit(),(req,res,next)=>{
  const {id,clientTransactionId}=req.query;
  if(typeof id!=='string' || !/^[1-9][0-9]{0,9}$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id)>2147483647 || typeof clientTransactionId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientTransactionId) || Object.keys(req.query).some(key=>!['id','clientTransactionId'].includes(key)))throw new AppError(422,'INVALID_PAYMENT_CALLBACK','La respuesta de pago no es válida.');next();
 },controller.response);
 return router;
};
