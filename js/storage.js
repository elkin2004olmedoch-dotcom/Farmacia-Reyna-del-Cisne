(function (global) {
  'use strict';
  const CART_KEY = 'farmacia-reyna-cart';
  const FILTER_KEY = 'farmacia-reyna-filters';
  const memory = new Map();

  function read(area, key, fallback) {
    try {
      const raw = global[area].getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return memory.get(key) ?? fallback; }
  }

  function write(area, key, value) {
    memory.set(key, value);
    try { global[area].setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  function saveCart(items) {
    const updatedAt = new Date().toISOString();
    const saved = write('localStorage', CART_KEY, { version: 2, items, updatedAt });
    return { saved, updatedAt };
  }

  const readCart = () => read('localStorage', CART_KEY, {});
  const readFilters = () => {
    const filters = read('sessionStorage', FILTER_KEY, {});
    return filters && typeof filters === 'object' && !Array.isArray(filters) ? filters : {};
  };
  const saveFilters = (filters) => write('sessionStorage', FILTER_KEY, filters);

  function saveSort(sort) {
    if (!['recommended', 'low', 'high'].includes(sort)) return false;
    try {
      const secure = global.location?.protocol === 'https:' ? '; Secure' : '';
      global.document.cookie = `farmacia-sort=${sort}; Max-Age=2592000; Path=/; SameSite=Lax${secure}`;
      return readSort() === sort;
    } catch (_) { return false; }
  }

  function readSort() {
    try {
      const value = global.document.cookie.match(/(?:^|;\s*)farmacia-sort=(recommended|low|high)(?:;|$)/);
      return value ? value[1] : 'recommended';
    } catch (_) { return 'recommended'; }
  }

  let database;
  function openDatabase() {
    if (database) return database;
    database = new Promise((resolve) => {
      if (!global.indexedDB) return resolve(null);
      let finished = false;
      const timer = global.setTimeout(() => finish(null), 2000);
      function finish(db) {
        if (finished) { db?.close(); return; }
        finished = true;
        global.clearTimeout(timer);
        resolve(db);
      }
      try {
        const request = global.indexedDB.open('farmacia-reyna', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('products')) request.result.createObjectStore('products');
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          finish(db);
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
      } catch (_) { finish(null); }
    });
    return database;
  }

  async function cacheProducts(products) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction('products', 'readwrite');
        transaction.objectStore('products').put({ products, updatedAt: new Date().toISOString() }, 'catalogo');
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = transaction.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  async function getCachedProducts() {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction('products', 'readonly').objectStore('products').get('catalogo');
        request.onsuccess = () => resolve(request.result?.products ?? null);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }

  (global.Farmacia ||= {}).storage = { readCart, saveCart, readFilters, saveFilters, readSort, saveSort, cacheProducts, getCachedProducts };
})(globalThis);
