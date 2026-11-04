const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const confirmation=text=>({text,actions:[{label:'Sí, confirmar',command:'confirmar'},{label:'No, cancelar',command:'cancelar'}]});
const validPrice=value=>(typeof value==='number'||typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value))&&Number.isFinite(Number(value))&&Number(value)>=0;
/** Only cart operations. Checkout, payment and administration are never submitted here. */
export function createCustomerCommandExecutor({catalog,cart,allowed=()=>true,navigate=()=>{},orders,session=()=>null}){
  let proposal=null,busy=false;
  const signature=()=>JSON.stringify(Object.entries(cart.read()).sort(([a],[b])=>a.localeCompare(b)));
  const restricted=p=>!allowed(p)||Boolean(p.requiereReceta||p.controlado||p.biologico||p.cadenaFrio);
  const available=(p,quantity)=>p&&p.activo!==false&&!restricted(p)&&validPrice(p.precio)&&Number.isInteger(p.stock)&&p.stock>=quantity;
  const visual=(p,cantidad)=>({id:p.id,nombre:p.nombre,imagen:p.imagen,alt:p.alt,presentacion:p.presentacion,precio:validPrice(p.precio)?Number(p.precio):null,stock:p.stock,activo:p.activo,restricted:restricted(p),...(cantidad?{cantidad}:{})});
  const productsSummary=items=>({kind:'products',items});
  const review=(action,product,quantity)=>{proposal={action,product,quantity,signature:signature()};return {...confirmation(action==='add'?`Agregar ${quantity} × ${product.nombre} a $${Number(product.precio).toFixed(2)} por unidad. Subtotal de esta selección: ${(Number(product.precio)*quantity).toFixed(2)}; el envío se revisa en la compra. ¿Confirmas?`:action==='remove'?`Quitar ${product.nombre} del carrito. ¿Confirmas?`:action==='clear'?'Vaciar todos los productos del carrito. ¿Confirmas?':'Abrir el checkout para revisar tu compra. El pedido se confirma allí. ¿Continuamos?'),...(product?{visualSummary:productsSummary([visual(product,quantity)])}:{})};};
  const account=()=>({text:'Inicia sesión en tu cuenta para consultar tus propios pedidos.',actions:[{label:'Abrir mi cuenta',href:'cuenta.html'}]});
  async function findProduct(id){try{return await catalog.find(id);}catch(error){if([404,410].includes(error.status))return null;throw error;}}
  async function cartSummary(){
    const before=signature(),items=await Promise.all(Object.entries(cart.read()).map(async([id,quantity])=>{const p=await findProduct(id);return p?visual(p,quantity):{id,nombre:'Producto retirado',precio:null,stock:0,activo:false,cantidad:quantity};}));
    if(signature()!==before)return {text:'El carrito cambió durante la consulta. Pide su resumen de nuevo.'};
    const subtotal=items.every(p=>validPrice(p.precio))?items.reduce((sum,p)=>sum+Math.round(p.precio*100)*p.cantidad,0):null;
    return {text:items.length?'Este es tu carrito con precios vigentes. Revisa disponibilidad y restricciones; el envío se confirma en el checkout.':'Tu carrito está vacío. Busca productos para empezar.',visualSummary:{kind:'cart',items,subtotalCentavos:subtotal},actions:[{label:'Revisar en checkout',href:'checkout.html'}]};
  }
  async function orderSummary(last){
    const user=session();if(!user?.id||!orders)return account();
    try{
      const result=await orders.mine(1);if(session()!==user)return account();
      const own=result.items.filter(order=>order.userId===user.id).slice(0,last?1:3);
      const images=new Map();
      for(const id of new Set(own.flatMap(order=>(order.detalles||[]).slice(0,4).map(line=>line.productoId))))images.set(id,await findProduct(id));
      if(session()!==user)return account();
      const items=own.map(order=>({id:order.id,estado:order.estado,total:order.total,remaining:Math.max(0,(order.detalles||[]).length-4),productos:(order.detalles||[]).slice(0,4).map(line=>({id:line.productoId,nombre:line.nombreProducto,precio:line.precioUnitario,cantidad:line.cantidad,imagen:line.imagen||images.get(line.productoId)?.imagen,alt:images.get(line.productoId)?.alt,presentacion:images.get(line.productoId)?.presentacion}))}));
      return {text:items.length?'Tus pedidos más recientes. El precio mostrado es el registrado al comprar.':'Todavía no tienes pedidos en esta cuenta.',visualSummary:{kind:'orders',items},actions:[{label:'Ver mis pedidos',href:'pedidos.html'}]};
    }catch(error){if([401,403].includes(error.status)||session()!==user)return account();throw error;}
  }
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
          if(!available(current,pending.quantity+(cart.read()[current?.id]||0)))throw new Error('El producto no está disponible para compra en línea. Consulta a la farmacia.');
          if(Number(current.precio)!==Number(pending.product.precio)){const next=review('add',current,pending.quantity);return {...next,text:'El precio cambió. '+next.text};}
          if(signature()!==pending.signature)throw new Error('El carrito cambió mientras consultaba el producto. Solicita la acción de nuevo.');
          cart.add(current,pending.quantity);return {text:`Añadido: ${pending.quantity} × ${current.nombre}. Puedes revisar el carrito.`,visualSummary:productsSummary([visual(current,pending.quantity)])};
        }
        if(pending.action==='remove')cart.remove(pending.product.id);
        if(pending.action==='clear')cart.clear();
        if(pending.action==='checkout'){navigate('checkout.html');return {text:'Abriendo el checkout para revisar tu pedido.'};}
        return {text:'Carrito actualizado.'};
      }
      proposal=null;
      if(/^(?:(?:ver|mostrar|muestra|abrir) )?(?:mi carrito|el carrito|carrito|resumen (?:de mi|del) carrito)$/.test(value))return await cartSummary();
      if(/^(?:(?:ver|mostrar|muestra) )?(?:mis pedidos|mi ultimo pedido|ultimo pedido)$/.test(value))return await orderSummary(value.includes('ultimo'));
      if(/^(?:(?:ver|abrir|abre|actualizar|actualiza|editar|edita)\s+)?(?:mi\s+)?perfil$/.test(value))return {text:'En tu perfil puedes actualizar tu nombre y teléfono.',actions:[{label:'Abrir mi perfil',href:'cuenta.html'}]};
      if(/^(?:vaciar|vacia|limpiar|limpia)(?: el| mi)? carrito$/.test(value))return review('clear');
      if(/^(?:comprar|finalizar compra|ir a pagar|confirmar pedido)$/.test(value))return review('checkout');
      const choice=value.match(/^seleccionar (agregar|quitar) ([a-z0-9-]{1,80})(?: (\d{1,2}))?$/);
      if(choice){const product=await catalog.find(choice[2]);if(choice[1]==='quitar')return review('remove',product);const quantity=Number(choice[3]||1);if(!Number.isInteger(quantity)||quantity<1||!available(product,quantity+(cart.read()[product?.id]||0)))throw new Error('No hay unidades disponibles para esa cantidad en línea.');return review('add',product,quantity);}
      if(!/\b(productos?|buscar|busca|busco|agrega|agregar|anade|anadir|quita|quitar|elimina|eliminar)\b/.test(value))return null;
      const removing=/\b(quita|quitar|elimina|eliminar)\b/.test(value),items=cart.read();
      const query=value.replace(/^(?:quiero |necesito )?(?:buscar|busca|busco|agrega|agregar|anade|anadir|quita|quitar|elimina|eliminar|ver|muestra)?\s*(?:un |los |mis |todos los )?(?:productos?)?\s*/,'').replace(/\b(?:al|del|el|mi) carrito\b/g,'').trim();
      const result=removing?{items:(await Promise.all(Object.keys(items).map(findProduct))).filter(Boolean)}:catalog.page?await catalog.page({q:query,pageSize:8}):{items:await catalog.all()};
      const products=result.items.filter(p=>p&&p.activo!==false&&(!removing||items[p.id])&&(!query||catalog.page&&!removing||normalize(p.nombre).includes(query))).slice(0,8);
      if(!products.length)return {text:'No encuentro productos disponibles con esa búsqueda. Prueba con otro nombre o abre el catálogo.'};
      const selectable=products.filter(p=>removing||available(p,1+(items[p.id]||0)));
      return {text:`${products.length} productos encontrados.${selectable.length?' Elige uno; revisarás la acción antes de confirmarla.':' Coordina disponibilidad y atención con la farmacia.'}`,visualSummary:productsSummary(products.map(p=>visual(p,removing?items[p.id]:null))),...(selectable.length?{fields:[{name:'product',label:removing?'Producto de tu carrito':'Producto disponible',options:selectable.map(p=>({value:p.id,label:`${p.nombre} · $${Number(p.precio).toFixed(2)}${removing?' · '+items[p.id]+' en carrito':''}`}))},...(removing?[]:[{name:'quantity',label:'Cantidad',type:'number',min:1,max:99,step:1,value:1}])],submit:values=>`seleccionar ${removing?'quitar':'agregar'} ${values.product}${removing?'':' '+values.quantity}`}:{})};
    }finally{busy=false;}
  };
}
