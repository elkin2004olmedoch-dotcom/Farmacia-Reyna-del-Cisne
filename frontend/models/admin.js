import {request} from './api.js';
export const administration={
  summary:()=>request('/admin/resumen'),
  table:(name,page=1)=>request(`/admin/tablas?tabla=${encodeURIComponent(name)}&page=${page}&pageSize=20`),
  saveProduct:(values,id)=>request('/productos'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removeProduct:id=>request('/productos/'+encodeURIComponent(id),{method:'DELETE'}),
  savePromotion:(values,id)=>request('/promociones'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  removePromotion:id=>request('/promociones/'+encodeURIComponent(id),{method:'DELETE'}),
  changeOrderState:(id,estado,esperadoUpdatedAt)=>request('/pedidos/'+encodeURIComponent(id)+'/estado',{method:'PUT',body:{estado,esperadoUpdatedAt}}),
  async uploadImage(file,signal){const bytes=new Uint8Array(await file.arrayBuffer());const chunks=[];for(let offset=0;offset<bytes.length;offset+=8192)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+8192)));return request('/admin/imagenes',{method:'POST',body:{archivo:btoa(chunks.join('')),nombreOriginal:file.name},signal});},
};
