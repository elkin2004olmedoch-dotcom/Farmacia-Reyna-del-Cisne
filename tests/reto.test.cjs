const test = require('node:test');
const assert = require('node:assert/strict');
const cart = require('../js/cart.js');
const validation = require('../js/validation.js');
const repo = require('../js/repo.js');

const products = [
  { id: 'a', name: 'Producto A', price: 12.5, category: 'bienestar', description: 'Descripción', image: 'assets/images/a.jpg', alt: 'Producto A' },
  { id: 'b', name: 'Producto B', price: 9.75, category: 'cuidado', description: 'Descripción', image: 'assets/images/b.jpg', alt: 'Producto B' },
];

test('añadir suma unidades; actualizar y quitar recalculan sin alterar el estado anterior', () => {
  const original = {};
  let items = cart.add(original, 'a', products);
  items = cart.add(items, 'a', products);
  items = cart.add(items, 'b', products);
  assert.deepEqual(original, {});
  assert.equal(cart.totals(items, products).subtotalCents, 3475);
  assert.equal(cart.totals(items, products).units, 3);
  items = cart.update(items, 'a', 3, products);
  assert.equal(cart.totals(items, products).totalCents, 4725);
  items = cart.remove(items, 'b');
  assert.deepEqual(items, { a: 3 });
  assert.equal(cart.totals(items, products).totalCents, 3750);
});

test('rechaza cantidades fraccionarias, vacías, negativas, mayores de 99 e identificadores desconocidos', () => {
  for (const value of [0, -1, 1.2, 100, NaN, '', '2x']) {
    assert.throws(() => cart.update({ a: 1 }, 'a', value, products));
  }
  assert.throws(() => cart.add({}, 'desconocido', products));
  assert.throws(() => cart.add({ a: 99 }, 'a', products));
});

test('migra el carrito antiguo y descarta datos corruptos o productos retirados', () => {
  assert.deepEqual(cart.normalizeStored(['a', 'b', 'retirado'], products), { a: 1, b: 1 });
  assert.deepEqual(cart.normalizeStored({ items: { a: 2, b: -3, retirado: 8 } }, products), { a: 2 });
  for (const invalid of [null, false, 'incorrecto', 12, { items: [] }]) {
    assert.deepEqual(cart.normalizeStored(invalid, products), {});
  }
});

test('calcula importes en centavos y no concatena precios ni acumula errores decimales', () => {
  assert.equal(cart.totals({ a: 3, b: 2 }, products).totalCents, 5700);
  assert.equal(cart.totals({}, products).totalCents, 0);
});

test('exporta la selección como JSON legible con cantidades, importes y fechas', () => {
  const items = { a: 3, b: 1 };
  const updatedAt = '2026-10-06T03:42:55.029Z';
  const exportedAt = '2026-10-06T03:43:00.000Z';
  const data = cart.exportData(items, products, updatedAt, exportedAt);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), {
    version: 1,
    farmacia: 'Farmacia Reina del Cisne',
    moneda: 'USD',
    fechaExportacion: exportedAt,
    ultimaActualizacion: updatedAt,
    productos: [
      { id: 'a', nombre: 'Producto A', cantidad: 3, precioUnitario: 12.5, subtotal: 37.5 },
      { id: 'b', nombre: 'Producto B', cantidad: 1, precioUnitario: 9.75, subtotal: 9.75 },
    ],
    unidades: 4,
    subtotal: 47.25,
    total: 47.25,
  });
  assert.deepEqual(items, { a: 3, b: 1 });
});

test('la exportación refleja cambios de cantidad y eliminación sin incluir productos retirados', () => {
  let items = cart.update({ a: 3, b: 1, retirado: 8 }, 'b', 2, products);
  items = cart.remove(items, 'a');
  const data = cart.exportData(items, products, null, '2026-10-06T03:43:00.000Z');
  assert.deepEqual(data.productos, [{ id: 'b', nombre: 'Producto B', cantidad: 2, precioUnitario: 9.75, subtotal: 19.5 }]);
  assert.equal(data.total, 19.5);
  assert.equal(data.unidades, 2);
  assert.equal(data.ultimaActualizacion, null);
  const empty = cart.exportData({}, products);
  assert.deepEqual(empty.productos, []);
  assert.equal(empty.total, 0);
  assert.ok(Number.isFinite(Date.parse(empty.fechaExportacion)));
});

test('validación acepta nombres con tildes y datos válidos', () => {
  assert.deepEqual(validation.validate({ name: 'José María', email: 'jose@example.com', phone: '+593 97 927 5988', message: 'Quiero consultar por un producto.' }), {});
});

test('validación rechaza campos vacíos, correos incorrectos y teléfonos no numéricos', () => {
  const errors = validation.validate({ name: '123', email: 'a@@correo', phone: 'llámame', message: 'hola' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'message', 'name', 'phone']);
  assert.equal(Object.keys(validation.validate({})).length, 4);
});

test('repositorio rechaza JSON sin esquema válido, duplicados y precios inválidos', () => {
  assert.equal(repo.validateProducts(products).length, 2);
  for (const invalid of [null, {}, [], [...products, products[0]], [{ ...products[0], price: -2 }], [{ ...products[0], price: '12.5' }], [{ ...products[0], image: 'javascript:alert(1)' }]]) {
    assert.throws(() => repo.validateProducts(invalid));
  }
});
