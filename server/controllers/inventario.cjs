const inventory=require('../models/inventario.cjs');
const suppliers=require('../models/proveedores.cjs');
const {AppError}=require('../middleware/errors.cjs');
module.exports={
 async suppliers(req,res){res.json({ok:true,data:await suppliers.list(req.input)});},
 async findSupplier(req,res){const data=await suppliers.find(req.input.id);if(!data)throw new AppError(404,'NOT_FOUND','No se encontró el proveedor.');res.json({ok:true,data});},
 async createSupplier(req,res){res.status(201).json({ok:true,data:await suppliers.create(req.input)});},
 async updateSupplier(req,res){const {id,esperadoUpdatedAt,...data}=req.input;res.json({ok:true,data:await suppliers.update(id,data,esperadoUpdatedAt??req.resourceVersion)});},
 async removeSupplier(req,res){await suppliers.remove(req.input.id,req.input.esperadoUpdatedAt);res.status(204).end();},
 async lots(req,res){res.json({ok:true,data:await inventory.listLots(req.input)});},
 async createLot(req,res){res.status(201).json({ok:true,data:await inventory.createLot(req.input,req.user.id)});},
 async movements(req,res){res.json({ok:true,data:await inventory.listMovements(req.input)});},
 async adjust(req,res){res.status(201).json({ok:true,data:await inventory.adjust(req.input,req.user.id)});},
};
