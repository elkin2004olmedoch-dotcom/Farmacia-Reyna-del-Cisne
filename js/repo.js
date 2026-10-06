(function (global) {
  'use strict';
  function validateProducts(data) {
    if (!Array.isArray(data) || !data.length || data.length > 1000) throw new Error('El catálogo está vacío o tiene un formato incorrecto.');
    const ids = new Set();
    return data.map((product) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)
        || typeof product.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(product.id) || ids.has(product.id)
        || typeof product.name !== 'string' || product.name.trim().length < 2 || product.name.length > 120
        || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0
        || product.price > 100000 || Math.abs(Math.round(product.price * 100) - product.price * 100) > 1e-8
        || typeof product.category !== 'string' || !['bienestar', 'cuidado', 'bebe'].includes(product.category)
        || typeof product.description !== 'string' || !product.description.trim() || product.description.length > 500
        || typeof product.alt !== 'string' || !product.alt.trim() || product.alt.length > 250
        || typeof product.image !== 'string' || !/^assets\/images\/[a-z0-9-]+\.(jpg|png|webp|svg)$/.test(product.image)
        || ['tag', 'badge', 'badgeClass', 'icon'].some((key) => product[key] !== undefined
          && (typeof product[key] !== 'string' || product[key].length > 80))) {
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
