const check=require('../models/salud.cjs');
module.exports=async(req,res)=>{await check();res.json({ok:true,data:{estado:'disponible'}});};
