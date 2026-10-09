const summary=require('../models/admin-summary.cjs');
module.exports=async function(req,res) {res.json({ok:true,data:await summary()});};
