const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {AppError}=require('../middleware/errors.cjs');
const {FRONTEND_ROOT,MAX_BYTES,contained,uploadsDirectory}=require('../middleware/imagevalidation.cjs');
let processing=0;
module.exports=async function saveImage({buffer,nombreOriginal},{frontendRoot=FRONTEND_ROOT}={}){
  if(processing>=2)throw new AppError(429,'IMAGE_BUSY','Estamos procesando otras imágenes. Intenta nuevamente en unos segundos.');
  processing++;
  try{
    let result;
    try{
      const jpeg=buffer.length>=3 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff;
      const png=buffer.length>=8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const webp=buffer.length>=12 && buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
      if(!jpeg && !png && !webp)throw new Error('Firma de archivo no admitida.');
      const image=sharp(buffer,{limitInputPixels:16000000,failOn:'warning',sequentialRead:true});
      const metadata=await image.metadata();
      const extension=path.extname(nombreOriginal).slice(1).toLowerCase();
      const expected=extension==='jpg'?'jpeg':extension;
      if(!['jpeg','png','webp'].includes(metadata.format) || expected!==metadata.format || (metadata.pages || 1)!==1 || !metadata.width || !metadata.height || metadata.width>8192 || metadata.height>8192 || metadata.width*metadata.height>16000000)throw new Error('Formato o tamaño no admitido.');
      result=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
      if(result.data.length>MAX_BYTES)throw new Error('La imagen procesada excede el tamaño permitido.');
    }catch(_){throw new AppError(422,'IMAGE_INVALID','No se pudo validar la imagen. Usa JPEG, PNG o WebP sin animación, hasta 2 MB y 16 millones de píxeles.');}
    const root=await fs.realpath(frontendRoot);const directory=uploadsDirectory(root);
    await fs.mkdir(directory,{recursive:true});
    if(!(process.env.NODE_ENV==='test' && process.env.UPLOAD_DIR) && !contained(root,await fs.realpath(directory)))throw new Error('El directorio de imágenes no es válido.');
    const name=randomUUID()+'.webp';await fs.writeFile(path.join(directory,name),result.data,{flag:'wx',mode:0o600});
    return {imagen:'assets/uploads/'+name,ancho:result.info.width,alto:result.info.height};
  }finally{processing--;}
};
