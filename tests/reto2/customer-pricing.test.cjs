const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const ec=require('../../frontend/models/ecuador.js');
const prices=import(pathToFileURL(path.resolve(__dirname,'../../frontend/models/pricing.js')).href);
test('carrito mixto concilia centavos por línea con los importes finales de venta',async()=>{
  const {cartPricing,linePricing}=await prices;
  const result=cartPricing([{producto:{precio:'0.03',ivaPorcentaje:15},cantidad:3},{producto:{precio:'2.01',ivaPorcentaje:0},cantidad:2}]);
  assert.equal(result.total,411);assert.equal(result.base,410);assert.equal(result.iva,1);assert.equal(result.base+result.iva,result.total);assert.equal(result.complete,true);
  assert.equal(linePricing({precio:'0.03',ivaPorcentaje:15},3).iva,1);
});
test('todas las tarifas de farmacia y descuentos finales conservan el precio cobrado',async()=>{
  const {linePricing}=await prices;
  for(const rate of [0,13,14,15])for(const quantity of [1,3,99])for(const cents of [1,3,15,101,201,9999]){const line=linePricing({precio:cents/100,ivaPorcentaje:rate},quantity);assert.equal(line.total,cents*quantity);assert.equal(line.base+line.iva,line.total);assert.ok(Math.abs(Math.round(line.base*rate/100)-line.iva)<=1);}
});
test('un pedido antiguo sin información fiscal no inventa una tarifa histórica',async()=>{
  const {cartPricing}=await prices;const result=cartPricing([{producto:{precio:'2.01'},cantidad:1}]);assert.equal(result.complete,false);assert.equal(result.total,201);assert.equal(result.base,0);assert.equal(result.iva,0);
});
test('la validación MVC admite RUC empresarial sin exigir un algoritmo no definido por SRI',()=>{
  for(const ruc of ['1790016918001','1770016919001','1760001560001'])assert.equal(ec.validRuc(ruc),true);
  for(const ruc of ['0000000000001','1790016918002','1790016918','179001691A001'])assert.equal(ec.validRuc(ruc),false);
  assert.equal(ec.validCedula('0102030400'),true);assert.equal(ec.validCedula('0102030401'),false);
  assert.equal(ec.validEmail('comprador@ejemplo.com'),true);assert.equal(ec.validEmail('..comprador@ejemplo.ec'),false);
  assert.equal(ec.normalizePhone('097 927 5988'),'+593979275988');
});
