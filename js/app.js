(function (global) {
  'use strict';
  const app = global.Farmacia;
  const menuButton = document.getElementById('menu-button');
  const menu = document.getElementById('mobile-nav');
  if (menuButton && menu) {
    const closeMenu = () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
    menuButton.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      menuButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); }
    });
    global.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
  }
  app.form.initialize();
  if (!document.getElementById('catalog-grid')) return;

  const state = { products: [], items: {}, query: '', category: 'todos', priceRange: 'all', sort: app.storage.readSort(), updatedAt: null };
  const dialog = document.getElementById('cart-dialog');
  const status = document.getElementById('catalog-status');
  const search = document.getElementById('catalog-search');
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const announce = (message) => {
    const target = dialog.open ? document.getElementById('cart-status') : status;
    target.textContent = '';
    global.setTimeout(() => { target.textContent = message; }, 20);
  };

  function visibleProducts() {
    const query = normalize(state.query.trim());
    const products = state.products.filter((product) =>
      (state.category === 'todos' || state.category === product.category)
      && (!query || normalize(`${product.name} ${product.description}`).includes(query))
      && (state.priceRange === 'all' || state.priceRange === 'under10' && product.price < 10
        || state.priceRange === '10-15' && product.price >= 10 && product.price <= 15
        || state.priceRange === 'over15' && product.price > 15));
    if (state.sort !== 'recommended') products.sort((a, b) => state.sort === 'low' ? a.price - b.price : b.price - a.price);
    return products;
  }

  function render() {
    const active = document.activeElement;
    const focusKey = active?.dataset.focusKey;
    const productId = !dialog.open ? active?.dataset.productId : null;
    app.view.renderProducts(visibleProducts(), state.items);
    app.view.renderCart(app.cart.totals(state.items, state.products), state.updatedAt);
    if (focusKey) {
      const next = dialog.querySelector(`[data-focus-key="${focusKey}"]`);
      if (next && !next.disabled) next.focus();
      else dialog.querySelector('.cart-close').focus();
    } else if (productId) document.querySelector(`.catalog-add[data-product-id="${productId}"]`)?.focus();
  }

  function saveChange(nextItems, message) {
    state.items = nextItems;
    const result = app.storage.saveCart(state.items);
    state.updatedAt = result.updatedAt;
    const warning = document.getElementById('storage-warning');
    warning.hidden = result.saved;
    warning.textContent = result.saved ? '' : 'El navegador bloqueó el almacenamiento. Puedes comprar, pero el carrito no se conservará al cerrar esta página.';
    render();
    announce(message);
  }

  function filtersChanged(announceResults = true) {
    document.querySelectorAll('[data-category]').forEach((button) => {
      const selected = button.dataset.category === state.category;
      if (button.getAttribute('role') === 'tab') {
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected) document.getElementById('catalog-grid').setAttribute('aria-labelledby', button.id);
      } else button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-price]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.price === state.priceRange)));
    document.getElementById('catalog-sort').value = state.sort;
    app.storage.saveFilters({ query: state.query, category: state.category, priceRange: state.priceRange, sort: state.sort });
    app.storage.saveSort(state.sort);
    render();
    if (announceResults) announce(`${visibleProducts().length} productos encontrados.`);
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-cart]');
    if (trigger) { if (!dialog.open) dialog.showModal(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.category) { state.category = button.dataset.category; filtersChanged(); return; }
    if (button.dataset.price) { state.priceRange = button.dataset.price; filtersChanged(); return; }
    if (button.id === 'catalog-clear') {
      Object.assign(state, { query: '', category: 'todos', priceRange: 'all', sort: 'recommended' });
      search.value = ''; filtersChanged(); return;
    }
    if (button.id === 'cart-clear') { saveChange({}, 'Carrito vaciado.'); return; }
    const id = button.dataset.productId;
    if (!id) return;
    const product = state.products.find((item) => item.id === id);
    try {
      const action = button.dataset.cartAction;
      const next = action === 'remove' ? app.cart.remove(state.items, id)
        : action === 'decrease' ? app.cart.update(state.items, id, state.items[id] - 1, state.products)
          : app.cart.add(state.items, id, state.products);
      saveChange(next, `${product.name}: ${next[id] || 0} unidades en el carrito.`);
    } catch (error) { announce(error.message); }
  });

  dialog.addEventListener('click', (event) => { if (event.target.closest('[data-close-cart]')) dialog.close(); });
  dialog.addEventListener('change', (event) => {
    const input = event.target.closest('[data-quantity-id]');
    if (!input) return;
    try {
      saveChange(app.cart.update(state.items, input.dataset.quantityId, input.value, state.products), 'Cantidad y total actualizados.');
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      const errorElement = document.getElementById(`quantity-error-${input.dataset.quantityId}`);
      errorElement.textContent = error.message; errorElement.hidden = false;
      announce(error.message);
    }
  });
  search.addEventListener('input', () => { state.query = search.value; filtersChanged(); });
  document.getElementById('catalog-sort').addEventListener('change', (event) => { state.sort = event.target.value; filtersChanged(); });
  document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(event.target);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    state.category = tabs[index].dataset.category;
    filtersChanged(); tabs[index].focus();
  });

  async function initialize() {
    try {
      state.products = await app.repo.loadProducts();
      const stored = app.storage.readCart();
      state.items = app.cart.normalizeStored(stored, state.products);
      state.updatedAt = stored?.updatedAt;
      if (!state.updatedAt || !Number.isFinite(Date.parse(state.updatedAt))) {
        const saved = app.storage.saveCart(state.items);
        state.updatedAt = saved.updatedAt;
        if (!saved.saved) document.getElementById('storage-warning').hidden = false;
      }
      const filters = app.storage.readFilters();
      if (typeof filters.query === 'string') state.query = filters.query.slice(0, 100);
      if (['todos', 'bienestar', 'cuidado', 'bebe'].includes(filters.category)) state.category = filters.category;
      if (['all', 'under10', '10-15', 'over15'].includes(filters.priceRange)) state.priceRange = filters.priceRange;
      if (['recommended', 'low', 'high'].includes(filters.sort)) state.sort = filters.sort;
      search.value = state.query;
      filtersChanged(false);
      document.getElementById('catalog-loading').hidden = true;
    } catch (error) {
      document.getElementById('catalog-loading').textContent = 'No se pudo cargar el catálogo. Recarga la página o revisa el archivo de productos.';
      announce(error.message);
    }
  }
  initialize();
})(globalThis);
