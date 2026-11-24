const normalize=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/[¿?¡!.,:;]/g,' ').replace(/\s+/g,' ').trim();

export function socialReply(text,staff=false){
  const words=normalize(text).replace(/\s+(?:goti|bro|pana|nano)$/,'');
  if(/^(?:gracias|muchas gracias|mil gracias|listo gracias|te agradezco)$/.test(words))
    return '¡Con gusto! Aquí estoy si necesitas algo más.';
  if(/^(?:hola|holi|holaa+|buenas|buenos dias|buenas tardes|buenas noches|que tal|que mas)(?: como estas)?$/.test(words))
    return staff?'¡Hola! ¿Qué vamos a revisar hoy: productos, promociones o pedidos?':'¡Hola! Puedo guiarte con tu compra. ¿Buscas algún producto o quieres revisar un pedido?';
  return null;
}

export function serviceReply(text,previous){
  const words=normalize(text);
  const schedule=/\b(?:horario|abren|atienden|cierran|estan abiertos|hasta que hora)\b/.test(words);
  const shipping=/\b(?:(?:hacen|tienen) (?:entregas|envios|delivery)|a domicilio|cuanto (?:vale|cuesta) el envio)\b/.test(words);
  const day=words.match(/\b(domingo|sabado)s?\b/)?.[1];
  if(!(schedule||shipping||(day&&previous==='horario')))return null;
  const parts=[];
  if(schedule||(day&&previous==='horario')){
    if(day==='domingo')parts.push('El domingo queda fuera del horario habitual. Atendemos de lunes a sábado, de 08:00 a 19:00.');
    else if(day==='sabado')parts.push('Sí, los sábados atendemos de 08:00 a 19:00.');
    else parts.push('Atendemos de lunes a sábado, de 08:00 a 19:00.');
  }
  if(shipping)parts.push('Sí, hacemos entregas a domicilio. Al poner tu dirección en la compra verás si hay cobertura y cuánto cuesta el envío antes de pagar.');
  const temas=[];
  if(schedule||(day&&previous==='horario'))temas.push('horario');
  if(shipping)temas.push('entrega');
  return {texto:parts.join(' '),tema:temas[0],temas};
}

export function productQuestion(text){
  const words=normalize(text);
  return words.match(/\b(?:a como (?:esta|sale|tienen)|cuanto (?:vale|cuesta)|(?:tienes|tienen|venden|busco)|precio (?:del?|de la))\s+(?:(?:el|la|los|las|un|una)\s+)?(.+)$/)?.[1]
    ?.replace(/\s+(?:por favor|porfa|bro|pana)$/,'').trim();
}

export function asksAboutLastProduct(text){
  return /^(?:y )?(?:cuanto (?:cuesta|vale)|a que precio|hay stock|queda alguno|esta disponible|lo tienen)$/.test(normalize(text));
}
