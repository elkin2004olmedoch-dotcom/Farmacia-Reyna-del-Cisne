const promos=require('../models/promociones.cjs');
const products=require('../models/productos.cjs');
const {AppError}=require('../middleware/errors.cjs');
function data(input) {const {id,...values}=input;return {...values,inicio:values.inicio?new Date(values.inicio):null,fin:values.fin?new Date(values.fin):null};}
async function reference(input) {if(!await products.find(input.productoId))throw new AppError(422,'INVALID_PRODUCT','Selecciona un producto disponible.');}
module.exports={
  async list(req,res) {res.json({ok:true,data:await promos.list()});},
  async create(req,res) {await reference(req.input);res.status(201).json({ok:true,data:await promos.create(data(req.input))});},
  async update(req,res) {await reference(req.input);res.json({ok:true,data:await promos.update(req.input.id,data(req.input))});},
  async remove(req,res) {await promos.remove(req.input.id);res.status(204).end();},
};
