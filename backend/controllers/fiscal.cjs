const model=require('../models/fiscal.cjs');
module.exports={
 async current(req,res){const {id,tarifaGeneral,inicioVigencia,referenciaNormativa}=await model.current();res.json({ok:true,data:{id,tarifaGeneral,inicioVigencia,referenciaNormativa}});},
 async history(req,res){res.json({ok:true,data:await model.history()});},
 async create(req,res){res.status(201).json({ok:true,data:await model.create(req.input,req.user.id)});},
};
