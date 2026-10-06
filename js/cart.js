(function (global) {
  'use strict';
  const MAX_QUANTITY = 99;
  const findProduct = (id, products) => products.find((product) => product.id === id);

  function quantity(value) {
    const number = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
    if (!Number.isInteger(number) || number < 1 || number > MAX_QUANTITY) {
      throw new RangeError('Introduce una cantidad entera entre 1 y 99.');
    }
    return number;
  }

  function update(items, id, value, products) {
    if (!findProduct(id, products)) throw new Error('Este producto no está disponible.');
    return { ...items, [id]: quantity(value) };
  }

  const add = (items, id, products) => update(items, id, (items[id] || 0) + 1, products);
  function remove(items, id) {
    const next = { ...items };
    delete next[id];
    return next;
  }

  function normalizeStored(value, products) {
    const source = Array.isArray(value)
      ? Object.fromEntries(value.filter((id) => typeof id === 'string').map((id) => [id, 1]))
      : value && typeof value === 'object' && value.items && !Array.isArray(value.items)
        ? value.items : {};
    const result = {};
    for (const product of products) {
      if (Object.hasOwn(source, product.id)) {
        try { result[product.id] = quantity(source[product.id]); } catch (_) { /* Descarta un dato inválido. */ }
      }
    }
    return result;
  }

  function totals(items, products) {
    const lines = products.filter(({ id }) => Object.hasOwn(items, id)).map((product) => {
      const units = quantity(items[product.id]);
      return { product, quantity: units, amountCents: Math.round(product.price * 100) * units };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    return { lines, units: lines.reduce((sum, line) => sum + line.quantity, 0), subtotalCents, totalCents: subtotalCents };
  }

  function exportData(items, products, updatedAt = null, exportedAt = new Date().toISOString()) {
    const summary = totals(items, products);
    return {
      version: 1,
      farmacia: 'Farmacia Reina del Cisne',
      moneda: 'USD',
      fechaExportacion: exportedAt,
      ultimaActualizacion: updatedAt,
      productos: summary.lines.map(({ product, quantity, amountCents }) => ({
        id: product.id,
        nombre: product.name,
        cantidad: quantity,
        precioUnitario: Math.round(product.price * 100) / 100,
        subtotal: amountCents / 100,
      })),
      unidades: summary.units,
      subtotal: summary.subtotalCents / 100,
      total: summary.totalCents / 100,
    };
  }

  const api = { MAX_QUANTITY, add, update, remove, normalizeStored, totals, exportData };
  (global.Farmacia ||= {}).cart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
