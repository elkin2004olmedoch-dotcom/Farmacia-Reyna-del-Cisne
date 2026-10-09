const fs=require('node:fs');
const path=require('node:path');
const {AppError}=require('./errors.cjs');
const FRONTEND_ROOT=path.resolve(__dirname,'../../frontend');
const UPLOAD_PATTERN=/^assets\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
const IMAGE_PATTERN=/^assets\/images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)$/;
const MAX_BYTES=2*1024*1024;
function contained(root,target){const relative=path.relative(root,target);return relative!=='' && !relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative);}
function uploadsDirectory(frontendRoot=FRONTEND_ROOT){return process.env.NODE_ENV==='test' && process.env.UPLOAD_DIR?path.resolve(process.env.UPLOAD_DIR):path.join(frontendRoot,'assets','uploads');}
function validImagePath(value,frontendRoot=FRONTEND_ROOT){
  if(typeof value!=='string' || !(IMAGE_PATTERN.test(value) || UPLOAD_PATTERN.test(value)))return false;
  try{const uploaded=UPLOAD_PATTERN.test(value);const root=fs.realpathSync(uploaded?uploadsDirectory(frontendRoot):frontendRoot);const file=fs.realpathSync(uploaded?path.join(root,path.basename(value)):path.resolve(root,value));return contained(root,file) && fs.statSync(file).isFile();}catch(_){return false;}
}
function imageValidation(req,res,next){
  try{
    const body=req.body;
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!['archivo','nombreOriginal'].includes(key)))throw new AppError(422,'IMAGE_INVALID','Envía el archivo y su nombre original.');
    const {archivo,nombreOriginal}=body;
    if(typeof nombreOriginal!=='string' || !/^[^<>:"/\\|?*\x00-\x1f]{1,120}\.(?:jpe?g|png|webp)$/i.test(nombreOriginal) || nombreOriginal.startsWith('.'))throw new AppError(422,'IMAGE_INVALID','Selecciona una imagen JPEG, PNG o WebP.');
    if(typeof archivo!=='string' || !archivo.length || archivo.length>Math.ceil(MAX_BYTES/3)*4 || archivo.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(archivo))throw new AppError(422,'IMAGE_INVALID','La imagen debe ser un archivo válido de hasta 2 MB.');
    const buffer=Buffer.from(archivo,'base64');
    if(buffer.length>MAX_BYTES || !buffer.length || buffer.toString('base64')!==archivo)throw new AppError(422,'IMAGE_INVALID','La imagen debe ser un archivo válido de hasta 2 MB.');
    req.imageInput={buffer,nombreOriginal};next();
  }catch(error){next(error);}
}
module.exports={validImagePath,imageValidation,FRONTEND_ROOT,UPLOAD_PATTERN,MAX_BYTES,contained,uploadsDirectory};
