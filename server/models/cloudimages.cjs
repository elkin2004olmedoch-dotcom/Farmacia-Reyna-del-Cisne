const {AppError}=require('../middleware/errors.cjs');
const {UPLOAD_PATTERN,MAX_BYTES}=require('../middleware/imagevalidation.cjs');
const REQUEST_TIMEOUT_MS=8000;
const MAX_ERROR_BYTES=4096;

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
    const modernKey=process.env.SUPABASE_SECRET_KEY;
    const key=modernKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(requireSecret && (typeof key!=='string' || !/^[\x21-\x7e]{1,8192}$/.test(key) || key.startsWith('sb_publishable_') || (modernKey && !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(modernKey))))throw new Error();
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
    const headers={apikey:key,'Content-Type':'image/webp','Cache-Control':'max-age=31536000','x-upsert':'false'};
    // Secret API keys are opaque, not JWTs; only legacy service_role uses Bearer.
    if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    const response=await fetch(origin+'/storage/v1/object/'+bucket+'/'+name,{method:'POST',headers,body:buffer,redirect:'error',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
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
    const url=origin+'/storage/v1/object/public/'+bucket+'/'+filename(reference);
    const signal=AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response=await fetch(url,{method:'HEAD',redirect:'error',signal});
    if(response.status===404)return false;
    // Some Storage versions return HTTP 400 for an absent object. HEAD has no
    // error body, so confirm the exact missing-object error before accepting it.
    if(response.status===400){
      const detail=await fetch(url,{method:'GET',redirect:'error',signal});
      try{
        if(detail.ok)return validImageResponse(detail);
        if(![400,404].includes(detail.status) || !/^application\/json(?:\s*;|$)/i.test(detail.headers.get('content-type') || ''))throw storageError();
        const error=await readStorageError(detail);
        if(error.code==='NoSuchKey' || (String(error.statusCode)==='404' && error.error==='not_found' && error.message==='Object not found'))return false;
        throw storageError();
      }finally{if(detail.body && !detail.body.locked)await detail.body.cancel();}
    }
    if(!response.ok)throw storageError();
    return validImageResponse(response);
  }catch(_){throw storageError();}
}
function validImageResponse(response){
  const bytes=Number(response.headers.get('content-length'));
  return /^image\/webp(?:\s*;|$)/i.test(response.headers.get('content-type') || '') && Number.isSafeInteger(bytes) && bytes>0 && bytes<=MAX_BYTES;
}
async function readStorageError(response){
  if(!response.body || Number(response.headers.get('content-length'))>MAX_ERROR_BYTES)throw storageError();
  const reader=response.body.getReader();
  const chunks=[];let bytes=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;if(bytes>MAX_ERROR_BYTES)throw storageError();
      chunks.push(Buffer.from(value));
    }
    const error=JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));
    if(!error || typeof error!=='object' || Array.isArray(error))throw storageError();
    return error;
  }finally{await reader.cancel();reader.releaseLock();}
}
module.exports={isCloudStorage,getPublicImageUrl,uploadCloudImage,cloudImageExists};
