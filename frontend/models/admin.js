import {request} from './api.js';
export const administration={
  table:(name,page=1)=>request(`/admin/tablas?tabla=${encodeURIComponent(name)}&page=${page}&pageSize=20`),
  saveProduct:(values,id)=>request('/productos'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removeProduct:id=>request('/productos/'+encodeURIComponent(id),{method:'DELETE'}),
  savePromotion:(values,id)=>request('/promociones'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removePromotion:id=>request('/promociones/'+encodeURIComponent(id),{method:'DELETE'}),
};
