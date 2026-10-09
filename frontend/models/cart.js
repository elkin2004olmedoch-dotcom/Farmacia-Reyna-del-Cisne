import {events} from './events.js';
const KEY='farmacia-mvc-carrito';
export const cart={
  read(){
    try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(!data || typeof data!=='object' || Array.isArray(data))return {};return Object.fromEntries(Object.entries(data).filter(([id,qty])=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) && Number.isInteger(qty) && qty>=1 && qty<=99));}catch(_){return {};}
  },
  write(items){try{localStorage.setItem(KEY,JSON.stringify(items));}catch(_){throw new Error('No se pudo guardar el carrito. Habilita el almacenamiento del navegador.');}events.dispatchEvent(new Event('cart:changed'));},
  add(product,quantity=1){const items=this.read();const next=(items[product.id]||0)+quantity;if(!Number.isInteger(next)||next<1||next>Math.min(product.stock,99))throw new Error('La cantidad supera las unidades disponibles.');items[product.id]=next;this.write(items);},
  update(id,quantity){const items=this.read();if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error('Usa una cantidad de 1 a 99 unidades.');items[id]=quantity;this.write(items);},
  remove(id){const items=this.read();delete items[id];this.write(items);},
  clear(){this.write({});},
  lines(products){return Object.entries(this.read()).map(([id,cantidad])=>({producto:products.find(product=>product.id===id),productoId:id,cantidad}));},
  total(products){return this.lines(products).reduce((sum,line)=>sum+(line.producto?Math.round(Number(line.producto.precio)*100)*line.cantidad:0),0);},
  payload(){return Object.entries(this.read()).map(([productoId,cantidad])=>({productoId,cantidad}));},
};
