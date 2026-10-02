(function (global) {
  'use strict';
  const money = (cents) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function renderProducts(products, items) {
    const grid = document.getElementById('catalog-grid');
    const template = document.getElementById('product-card-template');
    const fragment = document.createDocumentFragment();
    for (const product of products) {
      const card = template.content.firstElementChild.cloneNode(true);
      card.classList.add(`catalog-card--${product.category}`);
      const image = card.querySelector('img');
      image.src = product.image;
      image.alt = product.alt;
      card.querySelector('.catalog-badge').textContent = product.badge || 'Selección';
      card.querySelector('.catalog-tag').textContent = product.tag || product.category;
      card.querySelector('.catalog-icon').textContent = product.icon || '✚';
      card.querySelector('h2').textContent = product.name;
      card.querySelector('p').textContent = product.description;
      card.querySelector('.catalog-price').textContent = money(Math.round(product.price * 100));
      const button = card.querySelector('button');
      button.dataset.productId = product.id;
      button.textContent = items[product.id] ? `Añadir otra unidad (${items[product.id]}) +` : 'Añadir al carrito +';
      button.setAttribute('aria-label', `Añadir ${product.name} al carrito`);
      button.disabled = items[product.id] >= global.Farmacia.cart.MAX_QUANTITY;
      fragment.append(card);
    }
    if (!products.length) fragment.append(node('p', 'catalog-empty-state', 'No encontramos productos con esos filtros.'));
    grid.replaceChildren(fragment);
    document.getElementById('catalog-result-count').textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
  }

  function cartButton(action, product, text) {
    const button = node('button', action === 'remove' ? 'cart-remove' : 'quantity-button', text);
    button.type = 'button';
    button.dataset.cartAction = action;
    button.dataset.productId = product.id;
    button.dataset.focusKey = `${product.id}:${action}`;
    button.setAttribute('aria-label', `${action === 'remove' ? 'Quitar' : action === 'decrease' ? 'Reducir cantidad de' : 'Aumentar cantidad de'} ${product.name}`);
    return button;
  }

  function renderCart(totals, updatedAt) {
    const container = document.getElementById('cart-items');
    const fragment = document.createDocumentFragment();
    for (const { product, quantity, amountCents } of totals.lines) {
      const article = node('article', 'cart-item');
      const heading = node('h3', '', product.name);
      heading.id = `cart-name-${product.id}`;
      article.setAttribute('aria-labelledby', heading.id);
      const top = node('div', 'cart-item-heading');
      top.append(heading, cartButton('remove', product, 'Quitar'));
      const controls = node('div', 'quantity-controls');
      const label = node('label', 'sr-only', `Cantidad de ${product.name}`);
      label.htmlFor = `quantity-${product.id}`;
      const input = node('input', 'quantity-input');
      Object.assign(input, { type: 'number', min: '1', max: '99', step: '1', value: quantity, id: label.htmlFor });
      input.dataset.quantityId = product.id;
      input.dataset.focusKey = `${product.id}:quantity`;
      input.setAttribute('aria-describedby', `quantity-error-${product.id}`);
      const minus = cartButton('decrease', product, '−');
      minus.disabled = quantity <= 1;
      const plus = cartButton('increase', product, '+');
      plus.disabled = quantity >= 99;
      controls.append(label, minus, input, plus, node('strong', 'cart-line-price', money(amountCents)));
      const error = node('p', 'field-error');
      error.id = `quantity-error-${product.id}`;
      error.hidden = true;
      article.append(top, node('p', 'cart-unit-price', `${money(Math.round(product.price * 100))} por unidad`), controls, error);
      fragment.append(article);
    }
    container.replaceChildren(fragment);
    document.getElementById('cart-empty').hidden = totals.lines.length > 0;
    document.getElementById('cart-summary').textContent = `${totals.units} ${totals.units === 1 ? 'unidad' : 'unidades'}`;
    document.querySelectorAll('[data-cart-count]').forEach((element) => { element.textContent = totals.units; });
    document.getElementById('cart-subtotal').textContent = money(totals.subtotalCents);
    document.getElementById('cart-total').textContent = money(totals.totalCents);
    const time = document.getElementById('cart-updated');
    if (updatedAt && Number.isFinite(Date.parse(updatedAt))) {
      time.dateTime = updatedAt;
      time.textContent = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(updatedAt));
    } else { time.removeAttribute('datetime'); time.textContent = 'Sin cambios'; }
    const order = document.getElementById('whatsapp-order-link');
    order.hidden = !totals.units;
    const lines = totals.lines.map(({ product, quantity, amountCents }) => `${quantity} × ${product.name}: ${money(amountCents)}`);
    order.href = `https://wa.me/593979275988?text=${encodeURIComponent('Hola, quisiera consultar este pedido:\n' + lines.join('\n') + '\nTotal estimado: ' + money(totals.totalCents) + '. Por favor, confirmen disponibilidad y precio final.')}`;
    document.getElementById('cart-clear').disabled = !totals.units;
  }

  (global.Farmacia ||= {}).view = { money, renderProducts, renderCart };
})(globalThis);
