const model=require('../models/entregas.cjs');
const send=(res,data,status=200)=>res.status(status).json({ok:true,data});
module.exports={
 async zones(req,res){send(res,await model.zones());},
 async destination(req,res){const point=await require('../models/geocoding.cjs').prepare(req.input);send(res,{delivery:point?'delivery':'pickup',message:point?'Destino localizado.':'No pudimos localizar el destino. Seleccionamos retiro en farmacia, sin gastos de envío. Revisa y confirma nuevamente.'});},
 async adminZones(req,res){send(res,await model.zones(true));},
 async createZone(req,res){send(res,await model.saveZone(null,req.input,req.user),201);},
 async updateZone(req,res){const {id,...input}=req.input;send(res,await model.saveZone(id,input,req.user));},
 async drivers(req,res){send(res,await model.drivers());},
 async createDriver(req,res){send(res,await model.createDriver(req.input,req.user),201);},
 async driverActive(req,res){send(res,await model.setDriverActive(req.input.id,req.input.activo,req.user));},
 async list(req,res){send(res,await model.list(req.input,req.user));},
 async find(req,res){send(res,await model.find(req.input.id,req.user));},
 async route(req,res){const {id,...input}=req.input;send(res,await require('../models/rutas.cjs').calculate(id,req.user,input));},
 async claimTracking(req,res){send(res,await model.claimTracking(req.input.id,req.user));},
 async releaseTracking(req,res){send(res,await model.releaseTracking(req.input.id,req.user));},
 async assign(req,res){send(res,await model.assign(req.input,req.user));},
 async state(req,res,config){const {id,...input}=req.input;const notify=config?.emailVerification?.enabled&&input.estado==='entregada';const prior=notify?await model.find(id,req.user):null;const result=await model.changeState(id,input,req.user);const email=notify&&prior.estado!=='entregada'?await require('../models/document-email.cjs').createDocumentEmail().delivered(result.pedidoId,config):{status:'not_required'};res.json({ok:true,data:result,email});},
 async location(req,res){const {id,...input}=req.input;send(res,await model.setLocation(id,input,req.user));},
 async clearLocation(req,res){send(res,await model.clearLocation(req.input.id,req.user));},
 async tracking(req,res){send(res,await model.tracking(req.input.id,req.user));},
};
