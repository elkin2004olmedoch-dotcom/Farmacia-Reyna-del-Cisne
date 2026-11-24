const check=require('../models/salud.cjs');
const {AppError}=require('../middleware/errors.cjs');
module.exports=async(req,res)=>{try{await check();}catch{throw new AppError(503,'SERVICE_UNAVAILABLE','El servicio no está disponible.');}res.json({ok:true,data:{estado:'disponible'}});};
