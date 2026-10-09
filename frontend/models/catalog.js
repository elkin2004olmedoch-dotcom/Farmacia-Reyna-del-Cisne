import {request} from './api.js';
export const catalog={
  async all(){const first=await request('/productos?pageSize=100');const items=[...first.items];for(let page=2;items.length<first.total;page++){items.push(...(await request(`/productos?pageSize=100&page=${page}`)).items);}return items;},
  find:id=>request('/productos/'+encodeURIComponent(id)),
  promotions:()=>request('/promociones'),
};
