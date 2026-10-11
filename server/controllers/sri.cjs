'use strict';
const {AppError}=require('../middleware/errors.cjs');
const {createBilling}=require('../models/sri.cjs');
module.exports=function(config,dependencies={}) {
  const billing=createBilling({secret:config.secret,...dependencies});
  return {
    async configuration(req,res){res.json({ok:true,data:await billing.getConfig()});},
    async updateConfiguration(req,res){res.json({ok:true,data:await billing.setConfig(req.body)});},
    async certificate(req,res){res.json({ok:true,data:await billing.uploadCertificate(req.body)});},
    async list(req,res){if(Object.keys(req.query).some(key=>!['page','limit','pageSize'].includes(key))||[req.query.page,req.query.limit,req.query.pageSize].some(v=>v!==undefined&&(typeof v!=='string'||!/^\d+$/.test(v))))throw new AppError(422,'VALIDATION_FAILED','Revisa la página y el límite de facturas.');res.json({ok:true,data:await billing.listInvoices({page:Number(req.query.page||1),pageSize:Number(req.query.limit||req.query.pageSize||20)})});},
    async create(req,res){const result=await billing.createInvoice(req.body);res.status(result.replayed?200:201).json({ok:true,data:result.factura,replayed:result.replayed});},
    async emit(req,res){const body=req.body||{};if(Object.keys(body).some(key=>key!=='confirmarEmisionProduccion')||body.confirmarEmisionProduccion!==undefined&&typeof body.confirmarEmisionProduccion!=='boolean')throw new AppError(422,'VALIDATION_FAILED','Revisa la confirmación de emisión.');res.json({ok:true,data:await billing.emit(req.params.id,body)});},
    async own(req,res){res.json({ok:true,data:await billing.forOrder(req.params.id,req.user)});},
    async xml(req,res){const data=await billing.download(req.params.id,req.user);res.set('X-Content-Type-Options','nosniff').set('Content-Disposition',`attachment; filename="${data.filename}"`).type('application/xml').send(data.xml);},
    async ride(req,res){res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'").set('X-Content-Type-Options','nosniff').type('html').send(await billing.ride(req.params.id,req.user));}
  };
};
