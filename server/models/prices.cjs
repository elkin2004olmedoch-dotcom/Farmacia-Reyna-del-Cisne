const {Prisma}=require('@prisma/client');

function visibleWhere(now=new Date()) {
  return {activa:true,producto:{activo:true},AND:[{OR:[{inicio:null},{inicio:{lte:now}}]},{OR:[{fin:null},{fin:{gt:now}}]}]};
}
function discountWhere(now=new Date()) {return {...visibleWhere(now),vistaPrevia:false,descuentoPorcentaje:{gt:0}};}
function effectivePrice(product,promotions=product.promociones || [],now=new Date()) {
  const candidates=product.activo===false?[]:promotions.filter(promo=>promo.activa && !promo.vistaPrevia && promo.descuentoPorcentaje>0 && (!promo.inicio || new Date(promo.inicio)<=now) && (!promo.fin || new Date(promo.fin)>now));
  candidates.sort((a,b)=>b.descuentoPorcentaje-a.descuentoPorcentaje || a.orden-b.orden || a.id.localeCompare(b.id));
  const promotion=candidates[0];const percentage=promotion?.descuentoPorcentaje || 0;
  const originalCents=new Prisma.Decimal(product.precio).mul(100).toDecimalPlaces(0).toNumber();
  const cents=Math.round(originalCents*(100-percentage)/100);
  if(!Number.isSafeInteger(originalCents) || !Number.isSafeInteger(cents))throw new RangeError('El precio supera el rango de centavos admitido.');
  const {promociones,...values}=product;
  return {...values,precioOriginal:new Prisma.Decimal(originalCents).div(100),precio:new Prisma.Decimal(cents).div(100),descuentoPorcentaje:percentage,promocionId:promotion?.id || null};
}
module.exports={visibleWhere,discountWhere,effectivePrice};
