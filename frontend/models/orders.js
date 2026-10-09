import {request} from './api.js';
const KEY='farmacia-mvc-confirmacion';
export const orders={
  mine:page=>request(`/pedidos/mis-pedidos?page=${page||1}&pageSize=20`),
  all:page=>request(`/pedidos?page=${page||1}&pageSize=20`),
  async create(carrito,comprador){
    const payload={carrito,comprador};const signature=JSON.stringify(payload);
    // Solo se guarda la clave y una huella, nunca el documento completo.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature));
    const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
    let saved;try{saved=JSON.parse(sessionStorage.getItem(KEY));}catch(_){}
    const key=saved?.digest===digest?saved.key:crypto.randomUUID();
    sessionStorage.setItem(KEY,JSON.stringify({digest,key}));
    const order=await request('/pedidos',{method:'POST',body:{...payload,claveSolicitud:key}});
    sessionStorage.removeItem(KEY);return order;
  },
};
