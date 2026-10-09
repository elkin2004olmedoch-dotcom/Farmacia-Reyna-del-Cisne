import {request} from './api.js';
export const catalog={
  async all(){const first=await request('/productos?pageSize=100');const items=[...first.items];for(let page=2;page<=Math.ceil(first.total/first.pageSize);page++){const result=await request(`/productos?pageSize=100&page=${page}`);items.push(...result.items);if(result.items.length<result.pageSize)break;}return [...new Map(items.map(item=>[item.id,item])).values()];},
  find:id=>request('/productos/'+encodeURIComponent(id)),
  promotions:()=>request('/promociones'),
};
