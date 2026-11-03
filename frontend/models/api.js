import {events,dataChanged} from './events.js';
import {apiUrl} from '../config.js';
export class ApiError extends Error {
  constructor(message,status=0,details=[],code) {super(message);Object.assign(this,{status,details});if(typeof code==='string')this.code=code;}
}
// The timeout covers reading the response too. Only public, idempotent catalog GETs retry.
let renewing=null;
async function renewSession(){
  if(!renewing)renewing=apiFetch('/auth/web/refresh',{method:'POST',headers:{'X-Farmacia-Web':'1','Content-Type':'application/json'},body:'{}'},async response=>{if(response.status===204)return false;if(!response.ok)throw new ApiError('No se pudo renovar la sesión. Intenta nuevamente.',response.status);return true;}).finally(()=>{renewing=null;});
  return renewing;
}
export async function apiFetch(path,{method='GET',headers={},body,signal,keepalive=false,timeoutMs=method==='GET'&&path!=='/auth/me'?10000:60000,sessionRetry=true}={},consume){
  const retry=method==='GET' && /^\/(?:productos(?:\/[^/?#]+)?|promociones)(?:\?|$)/.test(path);
  for(let attempt=0;attempt<=(retry?1:0);attempt++){
    if(signal?.aborted)throw signal.reason || new DOMException('Solicitud cancelada.','AbortError');
    const controller=new AbortController();let timedOut=false;
    const abort=()=>controller.abort(signal.reason);
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
      const response=await fetch(apiUrl(path),{method,headers,body,signal:controller.signal,cache:'no-store',credentials:'same-origin',...(keepalive?{keepalive:true}:{})});
      if(response.status===401&&sessionRetry&&!headers.Authorization&&(!path.startsWith('/auth/')||path==='/auth/me')){
        await response.body?.cancel();
        if(await renewSession())return apiFetch(path,{method,headers,body,signal,keepalive,timeoutMs,sessionRetry:false},consume);
        return await consume(new Response(JSON.stringify({error:{message:'Inicia sesión para continuar.'}}),{status:401,headers:{'Content-Type':'application/json'}}));
      }
      if(!(retry && attempt===0 && [502,503,504].includes(response.status)))return await consume(response);
      await response.body?.cancel();
    }catch(error){
      if(signal?.aborted)throw signal.reason || error;
      if(!timedOut && error instanceof ApiError)throw error;
      if(!timedOut && !['TypeError','AbortError'].includes(error.name))throw error;
      if(!retry || attempt===1)throw new ApiError(timedOut?'La farmacia está tardando en responder. Puedes seguir explorando e intentar nuevamente.':'No pudimos conectar con la farmacia. Revisa tu conexión e intenta nuevamente.');
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
}
export async function request(path,{method='GET',body,signal,keepalive=false,headers:extraHeaders={}}={}) {
  const headers={Accept:'application/json',...extraHeaders};
  if(!['GET','HEAD'].includes(method))headers['X-Farmacia-Web']='1';
  if(body!==undefined)headers['Content-Type']='application/json';
  return apiFetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,keepalive},async response=>{
  if(response.status===204){if(!path.startsWith('/auth/'))dataChanged();return null;}
  let payload;
  try {payload=await response.json();}catch(error){if(error.name==='AbortError')throw error;throw new ApiError('El servidor devolvió una respuesta inesperada.',response.status);}
  if(!response.ok) {
    if(response.status===401 && !path.startsWith('/auth/login')) {
      sessionStorage.removeItem('farmacia-mvc-token');
      events.dispatchEvent(new Event('session:expired'));
    }
    throw new ApiError(payload.error?.message || 'No pudimos completar la solicitud.',response.status,payload.error?.details || [],payload.error?.code);
  }
  if(method!=='GET' && !path.startsWith('/auth/'))dataChanged();
  return payload.data;
  });
}
