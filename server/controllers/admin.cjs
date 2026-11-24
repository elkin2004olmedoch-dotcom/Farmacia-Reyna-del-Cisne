const tables=require('../models/admin.cjs');
async function list(req,res){res.json({ok:true,data:await tables(req.input)});}
module.exports=Object.assign(list,{
 resources(req,res){res.json({ok:true,data:tables.resources()});},
 async find(req,res){res.json({ok:true,data:await tables.find(req.input.tabla,req.input.id)});},
});
