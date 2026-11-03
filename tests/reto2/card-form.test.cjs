const {test}=require('node:test'),assert=require('node:assert/strict');
const v=require('../../frontend/models/ecuador.js'),cards=require('../../frontend/models/card-policy.js');
const now=new Date('2026-11-03T12:00:00Z');
test('formulario de tarjeta: cinco marcas, Luhn, vencimiento y CVV de cada marca',()=>{
 for(const [cardNumber,cvv]of [['4111111111111111','123'],['5555555555554444','123'],['378282246310005','1234'],['30569309025904','123'],['6011111111111117','123']]){
  const values={holder:'Cliente Sintético',cardNumber,expiry:'12/30',cvv};assert.deepEqual(v.validateCard(values,now,cards.detectBrand),{});
  assert.ok(v.validateCard({...values,cardNumber:cardNumber.slice(0,-1)+'9'},now,cards.detectBrand).cardNumber);
  assert.ok(v.validateCard({...values,cvv:cvv+'0'},now,cards.detectBrand).cvv);
  for(const expiry of ['10/26','00/30','13/30','11/99'])assert.ok(v.validateCard({...values,expiry},now,cards.detectBrand).expiry);
 }
});
test('formato de tarjeta preserva agrupación y limita caracteres; no confunde formato con autorización',()=>{
 assert.equal(cards.formatNumber('378282246310005'),'3782 822463 10005');
 assert.equal(cards.formatNumber('4111x111111111111'),'4111 1111 1111 1111');
 assert.equal(cards.formatExpiry('1230'),'12/30');assert.equal(cards.formatExpiry('122030123'),'12/20');
});
