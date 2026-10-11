'use strict';
const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticate,roles}=require('../middleware/auth.cjs');
const {AppError}=require('../middleware/errors.cjs');
module.exports=function(config,dependencies={}) {
  const router=express.Router(),auth=authenticate(config),admin=roles('admin'),controller=require('../controllers/sri.cjs')(config,dependencies);
  const json=express.json({limit:'32kb',strict:true});
  const certificateLimit=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{ok:false,error:{code:'RATE_LIMITED',message:'Espera unos minutos antes de volver a cargar la firma.'}}});
  const emissionLimit=rateLimit({windowMs:60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,message:{ok:false,error:{code:'RATE_LIMITED',message:'Espera un minuto antes de volver a consultar el SRI.'}}});
  const id=(req,res,next)=>{if(!/^[A-Za-z0-9_-]{1,80}$/.test(req.params.id||''))throw new AppError(422,'INVALID_ID','El identificador no es válido.');next();};
  // Mount before the app's 32 KiB parser: auth and role check precede large upload.
  router.post('/admin/facturacion/certificado',auth,admin,certificateLimit,express.json({limit:'3mb',strict:true}),controller.certificate);
  router.get('/admin/facturacion/configuracion',auth,admin,controller.configuration);
  router.put('/admin/facturacion/configuracion',auth,admin,json,controller.updateConfiguration);
  router.get('/admin/facturacion/facturas',auth,admin,controller.list);
  router.post('/admin/facturacion/facturas',auth,admin,json,controller.create);
  router.post('/admin/facturacion/facturas/:id/emitir',auth,admin,id,emissionLimit,json,controller.emit);
  for(const prefix of ['/admin/facturacion/facturas','/facturacion/facturas']){
    router.get(prefix+'/:id/xml',auth,id,controller.xml);
    router.get(prefix+'/:id/ride',auth,id,controller.ride);
  }
  router.get('/pedidos/:id/factura',auth,id,controller.own);
  return router;
};
