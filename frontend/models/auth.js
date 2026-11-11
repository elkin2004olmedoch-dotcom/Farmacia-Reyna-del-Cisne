import {request,apiFetch,ApiError} from './api.js';
import {events} from './events.js';
let current=null,generation=0;
export const sessionSignalKey='farmacia-session-change';
function signalSession(){
  try{localStorage.setItem(sessionSignalKey,globalThis.crypto?.randomUUID?.() || Date.now()+'-'+Math.random());}catch{}
}
export const auth={
  get user(){return current;},
  get isAdmin(){return current?.role==='admin';},
  get isCourier(){return current?.role==='repartidor';},
  get isStaff(){return ['admin','repartidor'].includes(current?.role);},
  async restore({accept,registrationId}={}){
    const saved=generation;
    // The pending panel applies only the account its active registration expects.
    if(accept){
      let user=null;
      if(registrationId){
        const result=await apiFetch('/auth/registro-pendiente',{method:'POST',headers:{'X-Farmacia-Web':'1','Content-Type':'application/json'},body:JSON.stringify({registrationId}),timeoutMs:10000,sessionRetry:false},async response=>{
          if(response.status===204)return null;
          if(!response.ok)throw new ApiError('No se pudo comprobar la confirmación.',response.status);
          return (await response.json()).data;
        });
        if(result?.verified===false)return null;
        user=result?.verified===true?result.usuario:null;
      }
      if(!user)user=await apiFetch('/auth/me',{sessionRetry:false},async response=>{
        if(!response.ok)throw new ApiError('No se pudo comprobar la sesión.',response.status);
        return (await response.json()).data;
      });
      if(generation!==saved || !accept(user))return null;
      current=user;events.dispatchEvent(new Event('session:changed'));return current;
    }
    const legacy=sessionStorage.getItem('farmacia-mvc-token');
    if(legacy){await request('/auth/web/exchange',{method:'POST',headers:{Authorization:'Bearer '+legacy},body:{}});sessionStorage.removeItem('farmacia-mvc-token');}
    const user=await request('/auth/me');if(generation===saved)current=user;return current;
  },
  async login(values){const result=await request('/auth/login',{method:'POST',body:values});return result.mfaRequired?result:this.save(result);},
  async register(values){const result=await request('/auth/register',{method:'POST',body:values});return result.requiresEmailVerification?result:this.save(result);},
  async mfaLogin(challenge,code){return this.save(await request('/auth/mfa/login',{method:'POST',body:{challenge,code}}));},
  verifyEmail:token=>request('/auth/verify-email',{method:'POST',body:{token}}),
  resendVerification:email=>request('/auth/resend-verification',{method:'POST',body:{email}}),
  async updateProfile(values){const id=current?.id,saved=generation;const user=await request('/auth/me',{method:'PUT',body:values});if(!current||current.id!==id||generation!==saved)throw new Error('Tu sesión cambió. Inicia sesión nuevamente.');current=user;events.dispatchEvent(new Event('session:changed'));return current;},
  save({usuario}){sessionStorage.removeItem('farmacia-mvc-token');current=usuario;generation++;signalSession();events.dispatchEvent(new Event('session:changed'));return usuario;},
  async logout(){await request('/auth/logout',{method:'POST'});this.clear();signalSession();},
  clear(){current=null;generation++;sessionStorage.removeItem('farmacia-mvc-token');events.dispatchEvent(new Event('session:changed'));},
};
