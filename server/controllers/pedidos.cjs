const orders=require('../models/pedidos.cjs');
const publicOrder=({requestKey,fingerprint,...order})=>order;
module.exports=config=>{
 const documents=require('../models/document-email.cjs').createDocumentEmail();
 return {
  async create(req,res) {const result=await orders.create(req.user.id,req.input);const email=result.replayed?{status:'replayed'}:await documents.receipt(result.pedido,config);res.status(result.replayed?200:201).json({ok:true,data:publicOrder(result.pedido),replayed:result.replayed,email});},
  async email(req,res){const billing=require('../models/sri.cjs').createBilling({secret:config.secret});res.json({ok:true,data:await documents.resend(req.input.id,req.user,config,billing)});},
  async mine(req,res) {const result=await orders.list(req.input,req.user.id);res.json({ok:true,data:{...result,items:result.items.map(publicOrder)}});},
  async all(req,res) {const result=await orders.list(req.input);res.json({ok:true,data:{...result,items:result.items.map(publicOrder)}});},
  async updateStatus(req,res) {const {id,...input}=req.input;const result=await orders.updateStatus(id,input,req.user.id);res.json({ok:true,data:publicOrder(result.pedido),replayed:result.replayed});},
 };
};
