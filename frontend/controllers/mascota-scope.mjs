function normalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();}

const medicalAdvice=/\b(dosis|sintoma|tratamiento|me duele|embaraz|diagnostic|efectos secundarios|contraindicaciones|interacciones|es seguro tomar|puedo tomar|que (?:tomo|tomar))\b|(?=.*\b(?:que es|para que sirve)\b)(?=.*\b(?:medicamento|medicina|paracetamol|acetaminofen|ibuprofeno|amoxicilina|loratadina)\b)/;
const pharmacyTerms=/\b(farmacia|farmaceutic[oa]|producto(?:s)?|catalogo|medicamento(?:s)?|medicina(?:s)?|carrito|pedido(?:s)?|compra|comprar|pagos?|payphone|tarjetas?|apple pay|entrega|retiro|receta|promocion(?:es)?|descuento(?:s)?|horario|abren|cierran|ubicacion|direccion|contacto|whatsapp|cuenta|registr|comparar|vitaminas?|protector solar|eucerin|pigeon|botiquin|blister|tabletas|frasco|alcohol antiseptico|gasas?|venda elastica|curitas?|termometro|mascarillas?|suero fisiologico|gel antibacterial|algodon|toallitas|paracetamol|acetaminofen|ibuprofeno|amoxicilina|loratadina)\b/;
const availability=/\b(precio|cuesta|disponibilidad|disponible|stock|tienen|venden|busco|buscar|encuentra|comprar)\b/;
const unrelatedIntent=/\b(ignora|olvida|finge|actua como|escribe|redacta|resume|traduce|resuelve|calcula|programa|codigo|tarea|chiste|juego|clima|noticias|politica|presidente|deporte|futbol|pelicula|serie|bitcoin|criptomoneda)\b/;

export function classifyMascotaQuestion(text,knownProducts=[]){
  const value=normalize(text);
  if(!value)return 'off-topic';
  if(medicalAdvice.test(value))return 'medical';
  if(unrelatedIntent.test(value))return 'off-topic';
  const knownProduct=knownProducts.some(name=>name&&value.includes(normalize(name)));
  if(pharmacyTerms.test(value)||knownProduct||availability.test(value)&&knownProduct)return 'pharmacy';
  return 'off-topic';
}
