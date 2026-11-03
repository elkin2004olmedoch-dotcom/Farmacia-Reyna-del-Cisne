const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const confirmation=text=>({text,actions:[{label:'Sí, confirmar',command:'confirmar'},{label:'No, cancelar',command:'cancelar'}]});
/** Only cart operations. Checkout, payment and administration are never submitted here. */
export function createCustomerCommandExecutor({catalog,cart,allowed=()=>true,navigate=()=>{}}){
  let proposal=null,busy=false;
  const signature=()=>JSON.stringify(Object.entries(cart.read()).sort(([a],[b])=>a.localeCompare(b)));
  const review=(action,product,quantity)=>{proposal={action,product,quantity,signature:signature()};return confirmation(action==='add'?`Agregar ${quantity} × ${product.nombre} a $${Number(product.precio).toFixed(2)} por unidad. ¿Confirmas?`:action==='remove'?`Quitar ${product.nombre} del carrito. ¿Confirmas?`:action==='clear'?'Vaciar todos los productos del carrito. ¿Confirmas?':'Abrir el checkout para revisar tu compra. El pedido se confirma allí. ¿Continuamos?');};
  return async text=>{
    if(busy)return {text:'Espera a que termine la solicitud anterior.'};busy=true;
    try{
      const value=normalize(text);
      if(/^(no|no,? cancelar|cancelar|cancela)$/.test(value)){proposal=null;return {text:'Cancelado. El carrito conserva sus productos.'};}
      if(/^(si|si,? confirmo|si,? confirmar|confirmar|confirmo)$/.test(value)){
        const pending=proposal;proposal=null;if(!pending)return {text:'No hay acciones pendientes. Busca un producto primero.'};
        if(signature()!==pending.signature)return {text:'El carrito cambió en otra ventana. Revisa sus productos y solicita la acción de nuevo.'};
        if(pending.action==='add'){
          const current=await catalog.find(pending.product.id);
          if(!allowed(current)||current.activo===false||current.requiereReceta||current.stock<pending.quantity)throw new Error('El producto no está disponible para compra en línea. Consulta a la farmacia.');
          if(Number(current.precio)!==Number(pending.product.precio)){const next=review('add',current,pending.quantity);return {...next,text:'El precio cambió. '+next.text};}
          if(signature()!==pending.signature)throw new Error('El carrito cambió mientras consultaba el producto. Solicita la acción de nuevo.');
          cart.add(current,pending.quantity);return {text:`Añadido: ${pending.quantity} × ${current.nombre}. Puedes revisar el carrito.`};
        }
        if(pending.action==='remove')cart.remove(pending.product.id);
        if(pending.action==='clear')cart.clear();
        if(pending.action==='checkout'){navigate('checkout.html');return {text:'Abriendo el checkout para revisar tu pedido.'};}
        return {text:'Carrito actualizado.'};
      }
      proposal=null;
      if(/^(?:vaciar|vacia|limpiar|limpia)(?: el| mi)? carrito$/.test(value))return review('clear');
      if(/^(?:comprar|finalizar compra|ir a pagar|confirmar pedido)$/.test(value))return review('checkout');
      const choice=value.match(/^seleccionar (agregar|quitar) ([a-z0-9-]{1,80})(?: (\d{1,2}))?$/);
      if(choice){const product=await catalog.find(choice[2]);if(choice[1]==='quitar')return review('remove',product);const quantity=Number(choice[3]||1);if(!allowed(product)||product.requiereReceta||product.stock<quantity)throw new Error('No hay unidades disponibles para esa compra en línea.');return review('add',product,quantity);}
      if(!/\b(productos?|buscar|busca|busco|agrega|agregar|anade|anadir|quita|quitar|elimina|eliminar)\b/.test(value))return null;
      const removing=/\b(quita|quitar|elimina|eliminar)\b/.test(value),items=cart.read();
      const query=value.replace(/^(?:quiero |necesito )?(?:buscar|busca|busco|agrega|agregar|anade|anadir|quita|quitar|elimina|eliminar|ver|muestra)?\s*(?:un |los |mis |todos los )?(?:productos?)?\s*/,'').replace(/\b(?:al|del|el|mi) carrito\b/g,'').trim();
      const products=(await catalog.all()).filter(p=>(removing?Boolean(items[p.id]):p.activo!==false&&p.stock>0&&allowed(p)&&!p.requiereReceta)&&(!query||normalize(p.nombre).includes(query)));
      if(!products.length)return {text:'No encuentro productos disponibles con esa búsqueda. Prueba con otro nombre o abre el catálogo.'};
      return {text:`${products.length} productos encontrados. Elige uno; revisarás la acción antes de confirmarla.`,fields:[{name:'product',label:removing?'Producto de tu carrito':'Producto disponible',options:products.map(p=>({value:p.id,label:`${p.nombre} · $${Number(p.precio).toFixed(2)}${removing?' · '+items[p.id]+' en carrito':''}`}))},...(removing?[]:[{name:'quantity',label:'Cantidad',type:'number',min:1,max:99,step:1,value:1}])],submit:values=>`seleccionar ${removing?'quitar':'agregar'} ${values.product}${removing?'':' '+values.quantity}`};
    }finally{busy=false;}
  };
}
