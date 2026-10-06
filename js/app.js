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
  const removeDialog = document.getElementById('cart-remove-dialog');
  let pendingRemoval = null;
  const status = document.getElementById('catalog-status');
  const search = document.getElementById('catalog-search');
  const orderForm = document.getElementById('cart-order-form');
  const orderFields = ['name', 'phone', 'address'];
  const savedBuyer = app.storage.readBuyer();
  const buyer = savedBuyer && typeof savedBuyer === 'object' && !Array.isArray(savedBuyer) ? savedBuyer : {};
  const buyerName = orderForm.elements.namedItem('name');
  const buyerPhone = orderForm.elements.namedItem('phone');
  const buyerAddress = orderForm.elements.namedItem('address');
  orderFields.forEach((key) => {
    const input = orderForm.elements.namedItem(key);
    if (typeof buyer[key] === 'string') input.value = buyer[key];
  });
  const orderButton = document.getElementById('whatsapp-order-link');
  const orderStatus = document.getElementById('cart-order-status');
  function updateBuyerValidity() {
    const errors = app.validation.validateBuyer({
      name: buyerName.value,
      phone: buyerPhone.value,
      address: buyerAddress.value,
    });
    buyerName.setCustomValidity(errors.name || '');
    buyerPhone.setCustomValidity(errors.phone || '');
    buyerAddress.setCustomValidity(errors.address || '');
  }
  updateBuyerValidity();
  orderForm.addEventListener('input', () => {
    updateBuyerValidity();
    app.storage.saveBuyer(Object.fromEntries(orderFields.map((key) => [key, orderForm.elements.namedItem(key).value])));
    orderButton.disabled = !orderForm.checkValidity() || !Object.keys(state.items).length;
    orderStatus.hidden = true;
    orderStatus.textContent = '';
  });
  document.getElementById('cart-buyer-clear').addEventListener('click', () => {
    app.storage.clearBuyer();
    orderForm.reset();
    updateBuyerValidity();
    orderButton.disabled = true;
    orderStatus.hidden = false;
    orderStatus.textContent = 'Se borraron los datos del comprador guardados en este navegador.';
    orderForm.elements.namedItem('name').focus();
  });
  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    updateBuyerValidity();
    if (!Object.keys(state.items).length || !orderForm.reportValidity()) return;
    if (!global.navigator.onLine) {
      orderStatus.hidden = false;
      orderStatus.textContent = 'Tu pedido y tus datos se conservan en este dispositivo. Conéctate para abrir WhatsApp y enviarlo.';
      return;
    }
    const details = Object.fromEntries(orderFields.map((key) => [key, orderForm.elements.namedItem(key).value.trim()]));
    const totals = app.cart.totals(state.items, state.products);
    const lines = totals.lines.map(({ product, quantity, amountCents }) => `${quantity} × ${product.name}: ${app.view.money(amountCents)}`);
    const message = [
      `Hola, quiero realizar este pedido.`, `Comprador: ${details.name}`,
      `Teléfono: ${details.phone}`, `Dirección: ${details.address}`,
      ...lines, `Total estimado: ${app.view.money(totals.totalCents)}. Por favor, confirmen disponibilidad y precio final.`
    ].join('\n');
    global.open(`https://wa.me/593979275988?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let announcementTimer;
  const announce = (message) => {
    global.clearTimeout(announcementTimer);
    const target = dialog.open ? document.getElementById('cart-status') : status;
    target.textContent = '';
    announcementTimer = global.setTimeout(() => { target.textContent = message; }, 100);
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
    const oldItems = [...dialog.querySelectorAll('.cart-item')];
    const itemIndex = oldItems.indexOf(active?.closest('.cart-item'));
    const productId = !dialog.open ? active?.dataset.productId : null;
    app.view.renderProducts(visibleProducts(), state.items);
    app.view.renderCart(app.cart.totals(state.items, state.products), state.updatedAt);
    if (focusKey) {
      const next = dialog.querySelector(`[data-focus-key="${focusKey}"]`);
      if (next && !next.disabled) next.focus();
      else {
        const remaining = [...dialog.querySelectorAll('.cart-item')];
        const nearby = remaining[Math.min(Math.max(itemIndex, 0), remaining.length - 1)];
        (nearby?.querySelector('.quantity-input') || document.getElementById('cart-continue')).focus();
      }
    } else if (dialog.open && active?.id === 'cart-clear' && !Object.keys(state.items).length) document.getElementById('cart-continue').focus();
    else if (productId) {
      const button = document.querySelector(`.catalog-add[data-product-id="${productId}"]`);
      (button?.disabled ? button.closest('article').querySelector('h3') : button)?.focus();
    }
  }

  function saveChange(nextItems, message) {
    state.items = nextItems;
    const result = app.storage.saveCart(state.items);
    state.updatedAt = result.updatedAt;
    const warning = document.getElementById('storage-warning');
    warning.hidden = result.saved;
    warning.textContent = result.saved ? '' : 'El navegador bloqueó el almacenamiento. Puedes comprar, pero el carrito no se conservará al cerrar esta página.';
    render();
    const total = app.view.money(app.cart.totals(state.items, state.products).totalCents);
    announce(`${message} Total estimado: ${total}.`);
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
    document.getElementById('catalog-price').value = state.priceRange;
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
    if (button.id === 'catalog-clear' || button.id === 'empty-reset') {
      Object.assign(state, { query: '', category: 'todos', priceRange: 'all', sort: 'recommended' });
      search.value = ''; filtersChanged();
      if (button.id === 'empty-reset') search.focus();
      return;
    }
    if (button.id === 'cart-clear') { saveChange({}, 'Carrito vaciado.'); return; }
    const id = button.dataset.productId;
    if (!id) return;
    const product = state.products.find((item) => item.id === id);
    try {
      const action = button.dataset.cartAction;
      if (action === 'remove') {
        pendingRemoval = { id, trigger: button, name: product.name };
        document.getElementById('cart-remove-description').textContent = `¿Estás seguro de que quieres quitar «${product.name}» de tu carrito?`;
        removeDialog.showModal();
        return;
      }
      const next = action === 'decrease' ? app.cart.update(state.items, id, state.items[id] - 1, state.products)
          : app.cart.add(state.items, id, state.products);
      const units = next[id] || 0;
      saveChange(next, `${product.name}: ${units} ${units === 1 ? 'unidad' : 'unidades'} en el carrito.`);
    } catch (error) { announce(error.message); }
  });

  document.getElementById('cart-remove-cancel').addEventListener('click', () => removeDialog.close());
  removeDialog.addEventListener('close', () => {
    // Ignora un close anterior que se entregue tras reabrir la confirmación.
    if (removeDialog.open || !pendingRemoval) return;
    pendingRemoval.trigger.focus();
    pendingRemoval = null;
  });
  document.getElementById('cart-remove-confirm').addEventListener('click', () => {
    if (!pendingRemoval) return;
    const { id, trigger, name } = pendingRemoval;
    pendingRemoval = null;
    removeDialog.close();
    trigger.focus();
    saveChange(app.cart.remove(state.items, id), `${name} se quitó del carrito.`);
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
  document.getElementById('catalog-price').addEventListener('change', (event) => { state.priceRange = event.target.value; filtersChanged(); });
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
