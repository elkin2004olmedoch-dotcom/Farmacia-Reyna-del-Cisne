(function (global) {
  'use strict';
  const CART_KEY = 'farmacia-reina-cart';
  const FILTER_KEY = 'farmacia-reina-filters';
  const CONTACT_KEY = 'farmacia-reina-contact-draft';
  const BUYER_KEY = 'farmacia-reina-buyer';
  const memory = new Map();
  const fieldLimits = { name: 80, email: 254, phone: 25, message: 1000, address: 200 };

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
    if (!items || typeof items !== 'object' || Array.isArray(items)
      || Object.entries(items).some(([id, units]) => !/^[a-z0-9-]{1,80}$/.test(id)
        || !Number.isInteger(units) || units < 1 || units > 99)) return { saved: false, updatedAt };
    const saved = write('localStorage', CART_KEY, { version: 2, items, updatedAt });
    return { saved, updatedAt };
  }

  const readCart = () => read('localStorage', CART_KEY, {});
  const cleanFields = (value, fields) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(fields.map((key) => [key,
      typeof value[key] === 'string' ? value[key].slice(0, fieldLimits[key]) : '']));
  };
  const readFilters = () => {
    const filters = read('localStorage', FILTER_KEY, {});
    return {
      query: typeof filters?.query === 'string' ? filters.query.slice(0, 100) : '',
      category: ['todos', 'bienestar', 'cuidado', 'bebe'].includes(filters?.category) ? filters.category : 'todos',
      priceRange: ['all', 'under10', '10-15', 'over15'].includes(filters?.priceRange) ? filters.priceRange : 'all',
      sort: ['recommended', 'low', 'high'].includes(filters?.sort) ? filters.sort : 'recommended',
    };
  };
  const saveFilters = (filters) => {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return false;
    return write('localStorage', FILTER_KEY, {
      query: typeof filters.query === 'string' ? filters.query.slice(0, 100) : '',
      category: ['todos', 'bienestar', 'cuidado', 'bebe'].includes(filters.category) ? filters.category : 'todos',
      priceRange: ['all', 'under10', '10-15', 'over15'].includes(filters.priceRange) ? filters.priceRange : 'all',
      sort: ['recommended', 'low', 'high'].includes(filters.sort) ? filters.sort : 'recommended',
    });
  };

  const readContactDraft = () => cleanFields(read('localStorage', CONTACT_KEY, {}), ['name', 'email', 'phone', 'message']);
  const saveContactDraft = (draft) => write('localStorage', CONTACT_KEY, cleanFields(draft, ['name', 'email', 'phone', 'message']));
  const readBuyer = () => cleanFields(read('localStorage', BUYER_KEY, {}), ['name', 'phone', 'address']);
  const saveBuyer = (buyer) => write('localStorage', BUYER_KEY, cleanFields(buyer, ['name', 'phone', 'address']));
  function clearSaved(key) {
    memory.delete(key);
    try { global.localStorage.removeItem(key); return true; } catch (_) { return false; }
  }
  const clearContactDraft = () => clearSaved(CONTACT_KEY);
  const clearBuyer = () => clearSaved(BUYER_KEY);

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
        const request = global.indexedDB.open('farmacia-reina', 1);
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

  (global.Farmacia ||= {}).storage = {
    readCart, saveCart, readFilters, saveFilters, readContactDraft, saveContactDraft,
    clearContactDraft, readBuyer, saveBuyer, clearBuyer, readSort, saveSort, cacheProducts, getCachedProducts
  };
})(globalThis);
