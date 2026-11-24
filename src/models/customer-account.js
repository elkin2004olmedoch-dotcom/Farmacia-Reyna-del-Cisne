import {request} from './api.js';
export const customerAccount={
 addresses:()=>request('/cuenta/direcciones'),
 saveAddress:(values,id)=>request('/cuenta/direcciones'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
 removeAddress:id=>request('/cuenta/direcciones/'+encodeURIComponent(id),{method:'DELETE'}),
 favorites:()=>request('/cuenta/favoritos'),
 favorite:(id,saved)=>request('/cuenta/favoritos/'+encodeURIComponent(id),{method:saved?'PUT':'DELETE',...(saved?{body:{}}:{})}),
 reorder:id=>request('/cuenta/pedidos/'+encodeURIComponent(id)+'/recompra'),
 reviews:(id,page=1)=>request(`/productos/${encodeURIComponent(id)}/resenas?page=${page}&pageSize=10`),
 eligibility:id=>request('/productos/'+encodeURIComponent(id)+'/resenas/mi-compra'),
 saveReview:(values,id)=>request('/cuenta/resenas'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
 removeReview:id=>request('/cuenta/resenas/'+encodeURIComponent(id),{method:'DELETE'}),
};
export function mergeReorder(existing,proposal,selected){
 const next={...existing};let added=0;
 for(const [id,quantity] of Object.entries(selected)){
  const line=proposal.items.find(item=>item.productoId===id),total=(next[id]||0)+quantity;
  if(!line||!Number.isInteger(quantity)||quantity<0||quantity>line.cantidadPermitida||total>Math.min(line.stock,99))throw new Error('Revisa las cantidades y el stock de la propuesta.');
  if(quantity){next[id]=total;added+=quantity;}
 }
 if(!added)throw new Error('Selecciona al menos una unidad disponible.');
 if(Object.keys(next).length>50)throw new Error('El carrito admite hasta cincuenta productos diferentes.');
 return next;
}
