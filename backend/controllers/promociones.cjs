const promos=require('../models/promociones.cjs');
const {AppError}=require('../middleware/errors.cjs');
function data(input,partial=false) {
 const {id,esperadoUpdatedAt,...values}=input;
 for(const field of ['inicio','fin'])if(!partial||Object.hasOwn(values,field))values[field]=values[field]?new Date(values[field]):null;
 return values;
}
module.exports={
  async list(req,res) {res.json({ok:true,data:await promos.list()});},
  async find(req,res) {const record=await promos.find(req.input.id);if(!record)throw new AppError(404,'NOT_FOUND','No se encontró la promoción.');res.json({ok:true,data:record});},
  async create(req,res) {res.status(201).json({ok:true,data:await promos.create(data(req.input))});},
  async update(req,res) {res.json({ok:true,data:await promos.update(req.input.id,data(req.input,req.method==='PATCH'),req.input.esperadoUpdatedAt??req.resourceVersion)});},
  async remove(req,res) {await promos.remove(req.input.id);res.status(204).end();},
};
