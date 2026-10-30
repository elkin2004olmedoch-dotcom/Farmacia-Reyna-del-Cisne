const {test}=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../../frontend/models/pharmacy-policy.js');

test('un artículo sin restricciones conserva compra y promoción permitidas',()=>{
  const product={requiereReceta:false,controlado:false,biologico:false,cadenaFrio:false};
  assert.equal(policy.requiresProfessionalReview(product),false);assert.equal(policy.allowsPromotion(product),true);assert.equal(policy.restrictionReason(product),'');
});
test('receta, controlados y biológicos exigen atención profesional y quedan fuera de publicidad',()=>{
  for(const field of ['requiereReceta','controlado','biologico']){
    const product={[field]:true};assert.equal(policy.requiresProfessionalReview(product),true);assert.equal(policy.allowsPromotion(product),false);assert.ok(policy.restrictionReason(product).length>20);
  }
});
test('cadena fría exige coordinación sin convertir su conservación en una prohibición legal de publicidad',()=>{
  assert.equal(policy.requiresProfessionalReview({cadenaFrio:true}),true);assert.equal(policy.allowsPromotion({cadenaFrio:true}),true);assert.match(policy.restrictionReason({cadenaFrio:true}),/fr[ií]o|temperatura/i);
});
test('un producto ausente no se trata como apto para comprar o promocionar',()=>{
  assert.equal(policy.requiresProfessionalReview(null),true);assert.equal(policy.allowsPromotion(null),false);assert.ok(policy.restrictionReason(null));
});
test('el precio público de un producto restringido no aplica campañas ni descuentos promocionales',()=>{
  const {effectivePrice}=require('../../server/models/prices.cjs');
  const now=new Date(),promotion={id:'campana',activa:true,vistaPrevia:false,descuentoPorcentaje:50,orden:0};
  for(const field of ['requiereReceta','controlado','biologico']){
    const priced=effectivePrice({id:'restringido',precio:10,stock:3,activo:true,descuentoPorcentaje:20,ivaCategoria:'general',lotes:[],[field]:true},[promotion],now);
    assert.equal(Number(priced.precio),10);assert.equal(priced.descuentoPorcentaje,0);assert.equal(priced.promocionId,null);
  }
});
