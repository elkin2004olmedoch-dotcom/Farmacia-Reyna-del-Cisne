import {request} from './api.js';
import {events} from './events.js';
let current=null;
export const auth={
  get user(){return current;},
  get isAdmin(){return current?.role==='admin';},
  get isCourier(){return current?.role==='repartidor';},
  get isStaff(){return ['admin','repartidor'].includes(current?.role);},
  async restore(){
    if(!sessionStorage.getItem('farmacia-mvc-token'))return null;
    current=await request('/auth/me');return current;
  },
  async login(values){return this.save(await request('/auth/login',{method:'POST',body:values}));},
  async register(values){const result=await request('/auth/register',{method:'POST',body:values});return result.requiresEmailVerification?result:this.save(result);},
  verifyEmail:token=>request('/auth/verify-email',{method:'POST',body:{token}}),
  resendVerification:email=>request('/auth/resend-verification',{method:'POST',body:{email}}),
  save({token,usuario}){sessionStorage.setItem('farmacia-mvc-token',token);current=usuario;events.dispatchEvent(new Event('session:changed'));return usuario;},
  async logout(){try{await request('/auth/logout',{method:'POST'});}finally{this.clear();}},
  clear(){current=null;sessionStorage.removeItem('farmacia-mvc-token');events.dispatchEvent(new Event('session:changed'));},
};
