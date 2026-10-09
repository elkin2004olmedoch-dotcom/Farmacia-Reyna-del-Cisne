const express=require('express');
const cors=require('cors');
const helmet=require('helmet');
const path=require('node:path');
const {rateLimit}=require('express-rate-limit');
const {AppError,errorHandler}=require('./middleware/errors.cjs');
module.exports=function createApp(settings=require('./config.cjs')()) {
  const app=express();app.disable('x-powered-by');
  app.use(require('./middleware/logger.cjs'));
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'",...settings.origins],frameSrc:['https://www.google.com'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],upgradeInsecureRequests:settings.production?[]:null}},strictTransportSecurity:settings.production?undefined:false}));
  app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next();},cors({origin(origin,callback){if(!origin || settings.origins.includes(origin))return callback(null,true);callback(new AppError(403,'CORS_FORBIDDEN','Origen no autorizado.'));},credentials:false,methods:['GET','POST','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization']}));
  app.use('/api',rateLimit({windowMs:60*1000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,handler:(req,res,next)=>next(new AppError(429,'RATE_LIMIT','Demasiadas solicitudes. Espera un minuto.'))}));
  app.use('/api',express.json({limit:'32kb',strict:true}));
  app.use('/api',require('./routes/index.cjs')(settings));
  app.use('/api',(req,res,next)=>next(new AppError(404,'NOT_FOUND','La ruta solicitada no existe.')));
  app.use(express.static(path.join(__dirname,'../frontend'),{dotfiles:'deny',index:'index.html',maxAge:0}));
  app.use((req,res,next)=>next(new AppError(404,'NOT_FOUND','La página solicitada no existe.')));
  app.use(errorHandler);return app;
};
