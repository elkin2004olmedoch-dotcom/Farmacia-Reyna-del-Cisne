const {AppError}=require('../middleware/errors.cjs');
const {UPLOAD_PATTERN,MAX_BYTES}=require('../middleware/imagevalidation.cjs');
const REQUEST_TIMEOUT_MS=8000;

function isCloudStorage(){return process.env.IMAGE_STORAGE==='supabase';}
function storageError(){return new AppError(503,'IMAGE_STORAGE_UNAVAILABLE','No se pudo guardar o consultar la imagen. Intenta nuevamente.');}
function configuration(requireSecret=false){
  try{
    const url=new URL(process.env.SUPABASE_URL || '');
    const official=url.protocol==='https:' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/.test(url.hostname) && !url.port;
    const localTest=process.env.NODE_ENV==='test' && url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if(!(official || localTest) || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error();
    const bucket=process.env.SUPABASE_STORAGE_BUCKET || 'farmaciaproductos';
    if(!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket))throw new Error();
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(requireSecret && (typeof key!=='string' || !/^[\x21-\x7e]{1,8192}$/.test(key)))throw new Error();
    return {origin:url.origin,bucket,key};
  }catch(_){throw storageError();}
}
function filename(reference){return typeof reference==='string' && UPLOAD_PATTERN.test(reference)?reference.slice('assets/uploads/'.length):null;}
function getPublicImageUrl(reference){
  const name=filename(reference);
  if(!isCloudStorage() || !name)return null;
  try{const {origin,bucket}=configuration();return origin+'/storage/v1/object/public/'+bucket+'/'+name;}catch(_){return null;}
}
async function uploadCloudImage(reference,buffer){
  const name=filename(reference);
  if(!name || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length>MAX_BYTES)throw new AppError(422,'IMAGE_INVALID','La imagen debe ser un archivo válido de hasta 2 MB.');
  if(!isCloudStorage())throw storageError();
  const {origin,bucket,key}=configuration(true);
  try{
    const response=await fetch(origin+'/storage/v1/object/'+bucket+'/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'image/webp','Cache-Control':'max-age=31536000','x-upsert':'false'},body:buffer,redirect:'error',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
    // Never expose provider responses, which may include credentials or project details.
    if(response.body)await response.body.cancel();
    if(!response.ok)throw storageError();
    return reference;
  }catch(_){throw storageError();}
}
async function cloudImageExists(reference){
  if(!filename(reference) || !isCloudStorage())return false;
  const {origin,bucket}=configuration();
  try{
    const response=await fetch(origin+'/storage/v1/object/public/'+bucket+'/'+filename(reference),{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
    if(response.status===404)return false;
    if(!response.ok)throw storageError();
    const bytes=Number(response.headers.get('content-length'));
    return /^image\/webp(?:\s*;|$)/i.test(response.headers.get('content-type') || '') && Number.isSafeInteger(bytes) && bytes>0 && bytes<=MAX_BYTES;
  }catch(_){throw storageError();}
}
module.exports={isCloudStorage,getPublicImageUrl,uploadCloudImage,cloudImageExists};
