(function (global) {
  'use strict';
  function validateProducts(data) {
    if (!Array.isArray(data) || !data.length) throw new Error('El catálogo está vacío o tiene un formato incorrecto.');
    const ids = new Set();
    return data.map((product) => {
      if (!product || !/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id)
        || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0
        || product.price > 100000 || !['bienestar', 'cuidado', 'bebe'].includes(product.category)
        || !['name', 'description', 'alt'].every((key) => typeof product[key] === 'string' && product[key].trim())
        || !/^assets\/images\/[a-z0-9-]+\.(jpg|png|webp|svg)$/.test(product.image)) {
        throw new Error('Hay un producto con datos inválidos.');
      }
      ids.add(product.id);
      return { ...product };
    });
  }

  async function loadProducts() {
    const app = global.Farmacia;
    if (global.location.protocol === 'file:') {
      const products = validateProducts(app.localProducts);
      await app.storage.cacheProducts(products);
      return products;
    }
    try {
      const response = await fetch('data/productos.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
      const products = validateProducts(await response.json());
      await app.storage.cacheProducts(products);
      return products;
    } catch (error) {
      const cached = await app.storage.getCachedProducts();
      if (cached) {
        try { return validateProducts(cached); } catch (_) { /* Usa la copia local si la caché está dañada. */ }
      }
      return validateProducts(app.localProducts);
    }
  }

  const api = { validateProducts, loadProducts };
  (global.Farmacia ||= {}).repo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
