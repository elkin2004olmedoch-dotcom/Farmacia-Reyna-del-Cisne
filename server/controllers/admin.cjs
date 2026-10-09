const tables=require('../models/admin.cjs');
module.exports=async function(req,res) {res.json({ok:true,data:await tables(req.input)});};
