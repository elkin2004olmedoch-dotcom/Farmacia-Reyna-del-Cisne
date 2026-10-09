const orders=require('../models/pedidos.cjs');
const publicOrder=({requestKey,fingerprint,...order})=>order;
module.exports={
  async create(req,res) {const result=await orders.create(req.user.id,req.input);res.status(result.replayed?200:201).json({ok:true,data:publicOrder(result.pedido),replayed:result.replayed});},
  async mine(req,res) {const result=await orders.list(req.input,req.user.id);res.json({ok:true,data:{...result,items:result.items.map(publicOrder)}});},
  async all(req,res) {const result=await orders.list(req.input);res.json({ok:true,data:{...result,items:result.items.map(publicOrder)}});},
  async updateStatus(req,res) {const {id,...input}=req.input;const result=await orders.updateStatus(id,input,req.user.id);res.json({ok:true,data:publicOrder(result.pedido),replayed:result.replayed});},
};
