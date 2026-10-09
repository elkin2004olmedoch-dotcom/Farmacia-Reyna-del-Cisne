import {events} from './events.js';
export class ApiError extends Error {
  constructor(message,status=0,details=[]) {super(message);Object.assign(this,{status,details});}
}
export async function request(path,{method='GET',body,signal}={}) {
  const headers={Accept:'application/json'};
  const token=sessionStorage.getItem('farmacia-mvc-token');
  if(token)headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try {response=await fetch(`/api${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,cache:'no-store'});}
  catch(error) {if(error.name==='AbortError')throw error;throw new ApiError('No pudimos conectar con la farmacia. Revisa tu conexión e intenta nuevamente.');}
  if(response.status===204)return null;
  let payload;
  try {payload=await response.json();}catch(_){throw new ApiError('El servidor devolvió una respuesta inesperada.',response.status);}
  if(!response.ok) {
    if(response.status===401 && !path.startsWith('/auth/login')) {
      sessionStorage.removeItem('farmacia-mvc-token');
      events.dispatchEvent(new Event('session:expired'));
    }
    throw new ApiError(payload.error?.message || 'No pudimos completar la solicitud.',response.status,payload.error?.details || []);
  }
  return payload.data;
}
