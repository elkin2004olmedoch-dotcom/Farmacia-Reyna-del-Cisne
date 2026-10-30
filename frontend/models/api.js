import {events,dataChanged} from './events.js';
import {apiUrl} from '../config.js';
export class ApiError extends Error {
  constructor(message,status=0,details=[]) {super(message);Object.assign(this,{status,details});}
}
// The timeout covers reading the response too. Only public, idempotent catalog GETs retry.
export async function apiFetch(path,{method='GET',headers={},body,signal,keepalive=false,timeoutMs=method==='GET'?10000:60000}={},consume){
  const retry=method==='GET' && /^\/(?:productos(?:\/[^/?#]+)?|promociones)(?:\?|$)/.test(path);
  for(let attempt=0;attempt<=(retry?1:0);attempt++){
    if(signal?.aborted)throw signal.reason || new DOMException('Solicitud cancelada.','AbortError');
    const controller=new AbortController();let timedOut=false;
    const abort=()=>controller.abort(signal.reason);
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
      const response=await fetch(apiUrl(path),{method,headers,body,signal:controller.signal,cache:'no-store',credentials:'omit',...(keepalive?{keepalive:true}:{})});
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
export async function request(path,{method='GET',body,signal,keepalive=false}={}) {
  const headers={Accept:'application/json'};
  const token=sessionStorage.getItem('farmacia-mvc-token');
  if(token)headers.Authorization=`Bearer ${token}`;
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
    throw new ApiError(payload.error?.message || 'No pudimos completar la solicitud.',response.status,payload.error?.details || []);
  }
  if(method!=='GET' && !path.startsWith('/auth/'))dataChanged();
  return payload.data;
  });
}
