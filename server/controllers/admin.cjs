const tables=require('../models/admin.cjs');
async function list(req,res){res.json({ok:true,data:await tables(req.input)});}
module.exports=Object.assign(list,{
 listResource:tabla=>async(req,res)=>res.json({ok:true,data:await tables({...req.input,tabla})}),
 resources(req,res){res.json({ok:true,data:tables.resources()});},
 async find(req,res){res.json({ok:true,data:await tables.find(req.input.tabla,req.input.id)});},
});
