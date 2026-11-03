const payments=require('../models/pagos.cjs');
const provider=require('../models/payphone.cjs');
module.exports={
 configuration(req,res){res.json({ok:true,data:provider.publicConfiguration()});},
 checkoutConfiguration(req,res){res.json({ok:true,data:{...provider.publicConfiguration(),practica:{disponible:payments.practiceAvailable()},transferencia:payments.transferConfiguration()}});},
 async find(req,res){res.json({ok:true,data:await payments.find(req.input.id,req.user)});},
 async start(req,res){const result=await payments.start(req.input.id,req.user);res.status(result.created?201:200).json({ok:true,data:result.data});},
 async practice(req,res){res.json({ok:true,data:await payments.practice(req.input.id,req.user,req.practiceInput)});},
 async response(req,res){res.setHeader('Referrer-Policy','no-referrer');res.redirect(303,await payments.confirm(Number(req.query.id),req.query.clientTransactionId));}
};
