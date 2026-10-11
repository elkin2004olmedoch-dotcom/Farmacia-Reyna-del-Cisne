const db=require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const fallback={id:'iva-general-inicial',tarifaGeneral:15,inicioVigencia:new Date('2024-04-01T05:00:00Z'),referenciaNormativa:'Ley de Régimen Tributario Interno, art. 65; Decreto Ejecutivo 198; Circular SRI NAC-DGECCGC25-00000006 (vigencia 2026).'};
async function current(client=db,now=new Date()) {
  return await client.configuracionFiscal.findFirst({where:{inicioVigencia:{lte:now}},orderBy:{inicioVigencia:'desc'}}) || fallback;
}
function inclusiveTax(totalCents,percentage) {
  if(!Number.isSafeInteger(totalCents) || totalCents<0 || ![0,13,14,15].includes(percentage))throw new RangeError('Importe o tarifa fiscal no admitidos.');
  const baseCents=Math.round(totalCents*100/(100+percentage));
  return {ivaPorcentaje:percentage,baseImponible:new Prisma.Decimal(baseCents).div(100),ivaMonto:new Prisma.Decimal(totalCents-baseCents).div(100)};
}
async function history() {return {vigente:await current(),historial:await db.configuracionFiscal.findMany({orderBy:{inicioVigencia:'desc'}})};}
async function create(data,actorId) {
  const inicioVigencia=new Date(data.inicioVigencia);
  if(inicioVigencia.getTime()<fallback.inicioVigencia.getTime())throw new AppError(422,'FISCAL_DATE','La vigencia debe empezar desde el 1 de abril de 2024.');
  return db.configuracionFiscal.create({data:{...data,inicioVigencia,actorId}});
}
module.exports={current,inclusiveTax,history,create};
