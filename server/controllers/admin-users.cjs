const users=require('../models/admin-users.cjs');
module.exports={
 async find(req,res){res.json({ok:true,data:await users.find(req.input.id)});},
 async create(req,res){res.status(201).json({ok:true,data:await users.create(req.input,req.user)});},
 async update(req,res){const {id,...values}=req.input;res.json({ok:true,data:await users.update(id,values,req.user)});},
 async remove(req,res){await users.remove(req.input.id,req.input.esperadoUpdatedAt,req.user);res.status(204).end();},
};
