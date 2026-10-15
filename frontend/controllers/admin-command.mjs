function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();}

function findProduct(text,products){
  const value=normalize(text);
  const matches=(products||[]).filter(product=>product?.nombre&&value.includes(normalize(product.nombre)));
  if(matches.length===1)return {product:matches[0]};
  if(matches.length>1)return {error:'Veo más de un producto en la orden. Escribe el nombre exacto de uno solo para evitar cambiar el registro equivocado.'};
  return {error:'No encuentro ese nombre exacto en el catálogo. Copia el nombre del producto tal como aparece en Productos.'};
}

function isoEndOfEcuadorDay(value){
  const start=new Date(`${value}T00:00:00-05:00`);
  if(!Number.isFinite(start.getTime())||!start.toISOString().startsWith(value))return null;
  return new Date(`${value}T23:59:59.999-05:00`).toISOString();
}

const needsDetails=message=>({type:'needs-details',message});

/** Interpreta únicamente órdenes comerciales explícitas; no consulta servicios externos. */
export function interpretAdminCommand(text,products=[]){
  const original=String(text||'').trim();
  const value=normalize(original);
  if(!value)return needsDetails('Escribe qué producto o promoción quieres gestionar.');
  if(/\b(?:ayuda|ejemplo|como funciona|que puedes hacer|que comandos)\b/.test(value))return {type:'help'};

  const promotionIntent=/\b(?:pon|poner|publica|publicar|activa|activar|crea|crear|sube|subir)\b/.test(value)&&/\b(?:promocion|promo|descuento|oferta)\b/.test(value);
  if(promotionIntent){
    const percentageMatch=value.match(/\b(\d{1,3})\s*%/);
    const untilMatch=value.match(/\bhasta(?:\s+el)?\s+(\d{4}-\d{2}-\d{2})\b/);
    const productMatch=findProduct(original,products);
    if(productMatch.error)return needsDetails(productMatch.error);
    if(!percentageMatch)return needsDetails('Dime el porcentaje de descuento, entre 1 % y 85 %.');
    const percentage=Number(percentageMatch[1]);
    if(percentage<1||percentage>85)return needsDetails('La promoción debe tener un descuento entre 1 % y 85 %.');
    if(!untilMatch)return needsDetails('Dime hasta qué fecha estará publicada, con formato AAAA-MM-DD y hora de Ecuador.');
    const todayEcuador=new Date(Date.now()-5*60*60*1000).toISOString().slice(0,10);
    if(untilMatch[1]<todayEcuador)return needsDetails('La fecha final ya pasó. Dime una fecha de hoy o futura para publicar la promoción.');
    const fin=isoEndOfEcuadorDay(untilMatch[1]);
    if(!fin)return needsDetails('Esa fecha no es válida. Usa el formato AAAA-MM-DD.');
    const {product}=productMatch;
    const titleMatch=original.match(/\b(?:titulada?|llamada?)\s+["“]([^"”]{2,120})["”]/i);
    const titulo=titleMatch?.[1]?.trim()||`Promoción ${percentage}% · ${product.nombre}`;
    return {type:'create-promotion',product,values:{titulo,etiqueta:`-${percentage}%`,descripcion:`Descuento del ${percentage}% en ${product.nombre}. Válido hasta ${untilMatch[1]} (hora de Ecuador).`,productoId:product.id,descuentoPorcentaje:percentage,orden:0,inicio:null,fin,activa:true,vistaPrevia:false,imagen:null,alt:null}};
  }

  const updateIntent=/\b(?:actualiza|actualizar|cambia|cambiar|modifica|modificar|ajusta|ajustar)\b/.test(value)&&/\b(?:producto|precio|stock|existencias|descuento)\b/.test(value);
  if(updateIntent){
    const productMatch=findProduct(original,products);
    if(productMatch.error)return needsDetails(productMatch.error);
    const changes={};
    const fieldText=normalize(original.replace(productMatch.product.nombre,''));
    const priceMatch=fieldText.match(/\bprecio\b[\s\S]{0,60}?\b(?:a|en)\s*(?:usd\s*|\$\s*)?(\d+(?:[.,]\d{1,2})?)/);
    const stockMatch=fieldText.match(/\b(?:stock|existencias)\s*(?:(?:a|en)\s*)?(\d+)\b/);
    const discountMatch=fieldText.match(/\bdescuento(?:\s+directo)?\s*(?:(?:a|en)\s*)?(\d{1,3})\s*%/);
    if(priceMatch)changes.precio=Number(priceMatch[1].replace(',','.'));
    if(stockMatch)changes.stock=Number(stockMatch[1]);
    if(discountMatch){const amount=Number(discountMatch[1]);if(amount>85)return needsDetails('El descuento directo permitido va de 0 % a 85 %.');changes.descuentoPorcentaje=amount;}
    if(!Object.keys(changes).length)return needsDetails('Indica el cambio: precio a 4,50; stock a 20; o descuento a 10 %.');
    return {type:'update-product',product:productMatch.product,changes};
  }

  return {type:'off-topic',message:'Puedo ayudarte desde este panel con cambios explícitos de precio, stock o descuento directo de un producto, y con promociones publicadas. No cambio pedidos, usuarios, impuestos ni facturas por chat.'};
}
