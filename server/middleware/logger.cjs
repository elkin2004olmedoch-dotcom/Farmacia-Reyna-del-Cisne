const {randomUUID} = require('node:crypto');
module.exports = function logger(req,res,next) {
  req.id=randomUUID();res.setHeader('X-Request-Id',req.id);
  const start=Date.now();
  res.on('finish',()=> {
    if(process.env.NODE_ENV!=='test') console.info(JSON.stringify({level:'info',requestId:req.id,method:req.method,path:req.path,status:res.statusCode,ms:Date.now()-start}));
  });
  next();
};
