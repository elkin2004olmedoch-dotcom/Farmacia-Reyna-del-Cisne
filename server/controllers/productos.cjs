const products=require('../models/productos.cjs');
const {AppError}=require('../middleware/errors.cjs');
async function existing(id) { const product=await products.find(id);if(!product)throw new AppError(404,'NOT_FOUND','El producto no está disponible.');return product; }
module.exports={
  async list(req,res) {res.json({ok:true,data:await products.list(req.input)});},
  async find(req,res) {res.json({ok:true,data:await existing(req.input.id)});},
  async create(req,res) {res.status(201).json({ok:true,data:await products.create(req.input)});},
  async update(req,res) {await existing(req.input.id);const {id,...data}=req.input;res.json({ok:true,data:await products.update(id,data)});},
  async remove(req,res) {await existing(req.input.id);await products.remove(req.input.id);res.status(204).end();},
};
