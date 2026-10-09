const saveImage=require('../models/imagenes.cjs');
module.exports=async function(req,res){res.status(201).json({ok:true,data:await saveImage(req.imageInput,{frontendRoot:req.app.locals.frontendRoot})});};
