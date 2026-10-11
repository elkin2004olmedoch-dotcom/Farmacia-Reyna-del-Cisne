const inventory=require('../models/inventario.cjs');
const suppliers=require('../models/proveedores.cjs');
module.exports={
 async suppliers(req,res){res.json({ok:true,data:await suppliers.list(req.input)});},
 async createSupplier(req,res){res.status(201).json({ok:true,data:await suppliers.create(req.input)});},
 async updateSupplier(req,res){const {id,...data}=req.input;res.json({ok:true,data:await suppliers.update(id,data)});},
 async lots(req,res){res.json({ok:true,data:await inventory.listLots(req.input)});},
 async createLot(req,res){res.status(201).json({ok:true,data:await inventory.createLot(req.input,req.user.id)});},
 async movements(req,res){res.json({ok:true,data:await inventory.listMovements(req.input)});},
 async adjust(req,res){res.status(201).json({ok:true,data:await inventory.adjust(req.input,req.user.id)});},
};
