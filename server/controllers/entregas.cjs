const model=require('../models/entregas.cjs');
const send=(res,data,status=200)=>res.status(status).json({ok:true,data});
module.exports={
 async zones(req,res){send(res,await model.zones());},
 async adminZones(req,res){send(res,await model.zones(true));},
 async createZone(req,res){send(res,await model.saveZone(null,req.input,req.user),201);},
 async updateZone(req,res){const {id,...input}=req.input;send(res,await model.saveZone(id,input,req.user));},
 async drivers(req,res){send(res,await model.drivers());},
 async createDriver(req,res){send(res,await model.createDriver(req.input,req.user),201);},
 async driverActive(req,res){send(res,await model.setDriverActive(req.input.id,req.input.activo,req.user));},
 async list(req,res){send(res,await model.list(req.input,req.user));},
 async assign(req,res){send(res,await model.assign(req.input,req.user));},
 async state(req,res){const {id,...input}=req.input;send(res,await model.changeState(id,input,req.user));},
 async location(req,res){const {id,...input}=req.input;send(res,await model.setLocation(id,input,req.user));},
 async clearLocation(req,res){send(res,await model.clearLocation(req.input.id,req.user));},
 async tracking(req,res){send(res,await model.tracking(req.input.id,req.user));},
};
