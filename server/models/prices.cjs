const {Prisma}=require('./prisma-client.cjs');
const {inclusiveTax}=require('./fiscal.cjs');
const {sellableStock,ecuadorDay}=require('./inventario.cjs');
const {allowsPromotion}=require('../../frontend/models/pharmacy-policy.js');

function visibleWhere(now=new Date()) {
  return {activa:true,producto:{activo:true,requiereReceta:false,controlado:false,biologico:false},AND:[{OR:[{inicio:null},{inicio:{lte:now}}]},{OR:[{fin:null},{fin:{gt:now}}]}]};
}
function discountWhere(now=new Date()) {return {...visibleWhere(now),vistaPrevia:false,descuentoPorcentaje:{gt:0}};}
// Public prices need only the expired balance; reservations still load complete lots.
function priceLots(now) {return {where:{vencimiento:{lt:ecuadorDay(now)},stock:{gt:0}},select:{stock:true,vencimiento:true}};}
function effectivePrice(product,promotions=product.promociones || [],now=new Date(),generalRate=15) {
  const eligible=product.activo!==false && allowsPromotion(product);
  const candidates=!eligible?[]:promotions.filter(promo=>promo.activa && !promo.vistaPrevia && promo.descuentoPorcentaje>0 && (!promo.inicio || new Date(promo.inicio)<=now) && (!promo.fin || new Date(promo.fin)>now));
  candidates.sort((a,b)=>b.descuentoPorcentaje-a.descuentoPorcentaje || a.orden-b.orden || a.id.localeCompare(b.id));
  const direct=!eligible?0:Math.min(85,Math.max(0,product.descuentoPorcentaje || 0));
  const campaign=candidates[0];const percentage=Math.min(85,Math.max(direct,campaign?.descuentoPorcentaje || 0));
  const promotion=campaign && campaign.descuentoPorcentaje>direct?campaign:null;
  const originalCents=new Prisma.Decimal(product.precio).mul(100).toDecimalPlaces(0).toNumber();
  const cents=Math.round(originalCents*(100-percentage)/100);
  if(!Number.isSafeInteger(originalCents) || !Number.isSafeInteger(cents))throw new RangeError('El precio supera el rango de centavos admitido.');
  const {promociones,lotes,...values}=product;
  const ivaPorcentaje=product.ivaCategoria==='cero'?0:generalRate;
  return {...values,stock:sellableStock(product,now),precioOriginal:new Prisma.Decimal(originalCents).div(100),precio:new Prisma.Decimal(cents).div(100),descuentoDirecto:direct,descuentoPorcentaje:percentage,promocionId:promotion?.id || null,...inclusiveTax(cents,ivaPorcentaje)};
}
module.exports={visibleWhere,discountWhere,priceLots,effectivePrice};
