const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { visiblePromotions } = require('../js/promotions.js');
const sample = JSON.parse(fs.readFileSync('data/promociones.json','utf8'));
test('campañas respetan publicación, orden y vigencia con hora de Ecuador', () => {
  const now = Date.parse('2026-10-07T08:00:00-05:00');
  const start = '2026-10-07T08:00:00-05:00';
  const end = '2026-10-08T08:00:00-05:00';
  const campaign = { ...sample[0], startsAt:start, endsAt:end };
  assert.equal(visiblePromotions([campaign], now-1).length,0);
  assert.equal(visiblePromotions([campaign], now).length,1);
  assert.equal(visiblePromotions([campaign], Date.parse(end)).length,0);
  assert.equal(visiblePromotions([{...campaign,active:false}], now).length,0);
  assert.deepEqual(visiblePromotions([...sample].reverse()).map(p=>p.id), sample.map(p=>p.id));
});
test('campañas descartan rutas externas, fechas ambiguas, duplicados y datos incompletos', () => {
  assert.equal(visiblePromotions([sample[0],sample[0]]).length,1);
  for (const patch of [{image:'https://example.com/image.png'},{productId:'javascript:alert(1)'},{startsAt:'2026-10-07'},{title:''},{demo:undefined},{startsAt:'2026-10-08T08:00:00-05:00',endsAt:'2026-10-07T08:00:00-05:00'}]) {
    assert.equal(visiblePromotions([{...sample[0],...patch}]).length,0);
  }
  assert.deepEqual(visiblePromotions([]),[]);
  assert.throws(()=>visiblePromotions({}));
});
test('promociones referencian productos e imágenes existentes y copia local actualizada', () => {
  const products = JSON.parse(fs.readFileSync('data/productos.json','utf8'));
  assert.equal(visiblePromotions(sample).length,sample.length);
  for (const item of sample) {
    assert.ok(products.some(p=>p.id===item.productId));
    assert.ok(fs.existsSync(item.image));
  }
  require('../data/promociones-local.js');
  assert.deepEqual(globalThis.Farmacia.localPromotions,sample);
});
