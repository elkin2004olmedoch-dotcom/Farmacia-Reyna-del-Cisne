const products = [
  {
    id: 'vitaminas',
    name: 'Vitaminas diarias',
    category: 'bienestar',
    description: 'Apoyo para tu rutina y energía.',
    price: 12.5,
    badge: 'Recomendado',
    badgeClass: 'catalog-badge',
    icon: '✚',
    tag: 'Bienestar',
    image:
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=700&q=80',
    alt: 'Frasco de vitaminas diarias',
  },
  {
    id: 'solar',
    name: 'Protector solar',
    category: 'cuidado',
    description: 'Protección diaria para tu piel.',
    price: 9.75,
    badge: 'Favorito',
    badgeClass: 'catalog-badge catalog-badge--sun',
    icon: '✦',
    tag: 'Cuidado personal',
    image:
      'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=80',
    alt: 'Protector solar para cuidado de la piel',
  },
  {
    id: 'bebe',
    name: 'Cuidado del bebé',
    category: 'bebe',
    description: 'Productos suaves para cada etapa.',
    price: 15,
    badge: 'Nuevo',
    badgeClass: 'catalog-badge',
    icon: '♡',
    tag: 'Mamá y bebé',
    image:
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=700&q=80',
    alt: 'Productos suaves para mamá y bebé',
  },
  {
    id: 'botiquin',
    name: 'Botiquín básico',
    category: 'bienestar',
    description: 'Lo esencial para tener a mano.',
    price: 18.9,
    badge: 'Esencial',
    badgeClass: 'catalog-badge catalog-badge--sun',
    icon: '✓',
    tag: 'Bienestar',
    image:
      'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=700&q=80',
    alt: 'Botiquín básico de primeros auxilios',
  },
];

const STORAGE_KEY = 'farmacia-reyna-cart';

const state = {
  query: '',
  category: 'todos',
  priceRange: 'all',
  sort: 'recommended',
  selected: new Set(loadCart()),
};

const elements = {
  grid: document.querySelector('#catalog-grid'),
  search: document.querySelector('#catalog-search'),
  cartItems: document.querySelector('#cart-items'),
  cartEmpty: document.querySelector('#cart-empty'),
  cartSummary: document.querySelector('#cart-summary'),
  cartTotal: document.querySelector('#cart-total'),
  orderLink: document.querySelector('#whatsapp-order-link'),
};

const priceClassMap = {
  all: 'price-all',
  under10: 'price-under-10',
  '10-15': 'price-mid',
  over15: 'price-over-15',
};

const formatPrice = (value) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('No se pudo cargar el carrito:', error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected]));
}

function getSelectedProducts() {
  return products.filter(({ id }) => state.selected.has(id));
}

function getVisibleProducts() {
  const query = state.query.trim().toLowerCase();

  const filtered = products.filter((product) => {
    const matchesCategory = state.category === 'todos' || product.category === state.category;
    const matchesQuery = !query || product.name.toLowerCase().includes(query) || product.description.toLowerCase().includes(query);

    const matchesPrice =
      state.priceRange === 'all' ||
      (state.priceRange === 'under10' && product.price < 10) ||
      (state.priceRange === '10-15' && product.price >= 10 && product.price <= 15) ||
      (state.priceRange === 'over15' && product.price > 15);

    return matchesCategory && matchesQuery && matchesPrice;
  });

  const sorted = [...filtered];
  if (state.sort === 'low') {
    sorted.sort((a, b) => a.price - b.price);
  }
  if (state.sort === 'high') {
    sorted.sort((a, b) => b.price - a.price);
  }

  return sorted;
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();

  if (!visibleProducts.length) {
    elements.grid.innerHTML = `
      <div class="catalog-empty-state">
        <p>No encontramos productos con ese filtro.</p>
      </div>
    `;
    return;
  }

  elements.grid.innerHTML = visibleProducts
    .map((product) => {
      const isSelected = state.selected.has(product.id);
      const priceClass = priceClassMap[product.price < 10 ? 'under10' : product.price <= 15 ? '10-15' : 'over15'];

      return `
        <article class="catalog-card catalog-card--${product.category} ${product.id === 'bebe' ? 'catalog-card--bebe-product' : ''} ${priceClass} ${isSelected ? 'is-selected' : ''}">
          <div class="catalog-photo-wrap">
            <img class="catalog-photo" src="${product.image}" alt="${product.alt}">
            <span class="${product.badgeClass}">${product.badge}</span>
          </div>
          <span class="catalog-tag">${product.tag}</span>
          <span class="catalog-icon">${product.icon}</span>
          <h2>${product.name}</h2>
          <p>${product.description}</p>
          <strong>${formatPrice(product.price)}</strong>
          <button type="button" class="catalog-add" data-product-id="${product.id}">
            ${isSelected ? 'Agregado ✓' : 'Añadir al carrito +'}
          </button>
        </article>
      `;
    })
    .join('');
}

function renderCart() {
  const selectedProducts = getSelectedProducts();
  const total = selectedProducts.reduce((sum, product) => sum + product.price, 0);

  elements.cartEmpty.hidden = selectedProducts.length > 0;
  elements.cartItems.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="cart-item">
          <span class="catalog-icon">${product.icon}</span>
          <span>
            <strong>${product.name}</strong>
            <small>1 unidad</small>
          </span>
          <b>${formatPrice(product.price)}</b>
        </div>
      `,
    )
    .join('');

  elements.cartSummary.textContent = `${selectedProducts.length} ${selectedProducts.length === 1 ? 'producto' : 'productos'}`;
  elements.cartTotal.textContent = formatPrice(total);

  const cartItems = [...selectedProducts.map((product) => product.name)];
  const message = cartItems.length
    ? `Hola, quiero pedir: ${cartItems.join(', ')}. Por favor, confirmen disponibilidad.`
    : 'Hola, quiero consultar por productos de la Farmacia Reyna del Cisne.';

  elements.orderLink.href = `https://wa.me/593979275988?text=${encodeURIComponent(message)}`;
}

function updateOrderButtonText() {
  const selectedProducts = getSelectedProducts();
  const orderButton = elements.orderLink;

  if (!selectedProducts.length) {
    orderButton.textContent = 'Elegir productos ↗';
    return;
  }

  orderButton.textContent = `Enviar pedido por WhatsApp ↗`;
}

function syncFiltersFromInputs() {
  const categoryInput = document.querySelector('input[name="product-tab"]:checked');
  const priceInput = document.querySelector('input[name="price-filter"]:checked');
  const sortInput = document.querySelector('input[name="product-sort"]:checked');

  const categoryMap = {
    'tab-todos': 'todos',
    'tab-bienestar': 'bienestar',
    'tab-cuidado': 'cuidado',
    'tab-bebe': 'bebe',
  };

  const priceMap = {
    'price-all': 'all',
    'price-under-10': 'under10',
    'price-10-15': '10-15',
    'price-over-15': 'over15',
  };

  state.category = categoryInput ? categoryMap[categoryInput.id] || 'todos' : 'todos';
  state.priceRange = priceInput ? priceMap[priceInput.id] || 'all' : 'all';
  state.sort = sortInput ? sortInput.id.replace('sort-', '') : 'recommended';
}

function setRadioGroupValue(name, id) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.id === id;
  });
}

function setInputValueByTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (target.type === 'radio') {
    setRadioGroupValue(target.name, target.id);
  } else if (target.type === 'checkbox') {
    target.checked = !target.checked;
  }

  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function attachEvents() {
  document.querySelectorAll('input[name="product-tab"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncFiltersFromInputs();
      renderProducts();
    });
  });

  document.querySelectorAll('input[name="price-filter"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncFiltersFromInputs();
      renderProducts();
    });
  });

  document.querySelectorAll('input[name="product-sort"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncFiltersFromInputs();
      renderProducts();
    });
  });

  document.querySelectorAll('[data-target]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const { target } = control.dataset;
      if (!target) return;

      if (target === 'cart-toggle') {
        const cartToggle = document.getElementById('cart-toggle');
        if (cartToggle) {
          cartToggle.checked = !cartToggle.checked;
          cartToggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      setInputValueByTarget(target);
    });
  });

  elements.search.addEventListener('input', (event) => {
    state.query = event.target.value;
    renderProducts();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-product-id]');
    if (!button) return;

    const { productId } = button.dataset;
    if (state.selected.has(productId)) {
      state.selected.delete(productId);
    } else {
      state.selected.add(productId);
    }

    saveCart();
    renderProducts();
    renderCart();
    updateOrderButtonText();
  });
}

function initialize() {
  syncFiltersFromInputs();
  attachEvents();
  renderProducts();
  renderCart();
  updateOrderButtonText();
}

initialize();
