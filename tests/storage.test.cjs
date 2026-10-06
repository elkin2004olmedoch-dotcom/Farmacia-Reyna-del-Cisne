const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(blocked = false) {
  const map = new Map();
  const area = { getItem: (key) => { if (blocked) throw Error('blocked'); return map.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw Error('blocked'); map.set(key, value); } };
  const context = { localStorage: area, sessionStorage: area, document: { cookie: '' }, Date, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync('js/storage.js', 'utf8'), context);
  return { storage: context.Farmacia.storage, map };
}

test('carrito guarda unidades y fecha; filtros persisten por sesión y orden en cookie', () => {
  const { storage } = load();
  const saved = storage.saveCart({ vitaminas: 3 });
  assert.equal(saved.saved, true);
  assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
  assert.equal(storage.readCart().items.vitaminas, 3);
  storage.saveFilters({ category: 'cuidado', query: 'solar', sort: 'low' });
  assert.equal(storage.readFilters().query, 'solar');
  storage.saveSort('low');
  assert.equal(storage.readSort(), 'low');
});

test('almacenamiento bloqueado o JSON corrupto no impiden utilizar el carrito', () => {
  const blocked = load(true).storage;
  assert.equal(blocked.saveCart({ vitaminas: 2 }).saved, false);
  assert.equal(blocked.readCart().items.vitaminas, 2);
  const { storage, map } = load();
  map.set('farmacia-reina-cart', '{broken');
  assert.equal(Object.keys(storage.readCart()).length, 0);
});

test('almacenamiento limita cantidades y normaliza filtros y datos de formularios', () => {
  const { storage } = load();
  assert.equal(storage.saveCart({ vitaminas: 100 }).saved, false);
  assert.equal(storage.saveCart({ 'javascript:alert(1)': 1 }).saved, false);
  storage.saveFilters({ query: 'x'.repeat(150), category: 'invalida', priceRange: 'invalido', sort: 'invalido' });
  assert.deepEqual(JSON.parse(JSON.stringify(storage.readFilters())), {
    query: 'x'.repeat(100), category: 'todos', priceRange: 'all', sort: 'recommended',
  });
  storage.saveBuyer({ name: 'n'.repeat(100), phone: 123, address: 'a'.repeat(250) });
  assert.deepEqual(JSON.parse(JSON.stringify(storage.readBuyer())), {
    name: 'n'.repeat(80), phone: '', address: 'a'.repeat(200),
  });
  storage.saveContactDraft({ name: 'n'.repeat(100), email: 'e'.repeat(300) });
  assert.deepEqual(JSON.parse(JSON.stringify(storage.readContactDraft())), {
    name: 'n'.repeat(80), email: 'e'.repeat(254), phone: '', message: '',
  });
});
