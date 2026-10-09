import {request} from './api.js';
import {events} from './events.js';
let current=null;
export const auth={
  get user(){return current;},
  get isAdmin(){return current?.role==='admin';},
  async restore(){
    if(!sessionStorage.getItem('farmacia-mvc-token'))return null;
    current=await request('/auth/me');return current;
  },
  async login(values){return this.save(await request('/auth/login',{method:'POST',body:values}));},
  async register(values){return this.save(await request('/auth/register',{method:'POST',body:values}));},
  save({token,usuario}){sessionStorage.setItem('farmacia-mvc-token',token);current=usuario;events.dispatchEvent(new Event('session:changed'));return usuario;},
  async logout(){try{await request('/auth/logout',{method:'POST'});}finally{this.clear();}},
  clear(){current=null;sessionStorage.removeItem('farmacia-mvc-token');events.dispatchEvent(new Event('session:changed'));},
};
