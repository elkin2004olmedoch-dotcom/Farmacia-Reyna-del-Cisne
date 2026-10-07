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
      const imageLink = document.createElement('a');
      imageLink.href = `producto.html?id=${product.id}`;
      image.replaceWith(imageLink); imageLink.append(image);
      card.querySelector('.catalog-badge').textContent = product.badge || 'Selección';
      card.querySelector('.catalog-tag').textContent = product.tag || product.category;
      const title = card.querySelector('h3');
      title.textContent = product.name;
      const detailLink = document.createElement('a');
      detailLink.href = `producto.html?id=${product.id}`;
      detailLink.textContent = product.name;
      title.replaceChildren(detailLink);
      title.id = `product-name-${product.id}`;
      card.setAttribute('aria-labelledby', title.id);
      card.querySelector('p').textContent = product.description;
      card.querySelector('.catalog-price').textContent = money(Math.round(product.price * 100));
      const button = card.querySelector('button');
      button.dataset.productId = product.id;
      button.textContent = items[product.id] ? 'Añadir otra unidad +' : 'Añadir al carrito +';
      button.setAttribute('aria-label', `${items[product.id] ? 'Añadir otra unidad' : 'Añadir al carrito'}: ${product.name}`);
      button.disabled = items[product.id] >= global.Farmacia.cart.MAX_QUANTITY;
      if (button.disabled) button.textContent = 'Límite de 99 unidades';
      card.querySelector('.product-cart-note').textContent = items[product.id] ? `${items[product.id]} ${items[product.id] === 1 ? 'unidad en tu carrito' : 'unidades en tu carrito'}` : '';
      const details = node('a', 'text-link catalog-detail-link', 'Ver producto →');
      details.href = `producto.html?id=${product.id}`;
      card.querySelector('.catalog-card-bottom').append(details);
      fragment.append(card);
    }
    if (!products.length) {
      const empty = node('div', 'catalog-empty-state');
      const reset = node('button', 'button button-outline', 'Mostrar todos los productos');
      reset.type = 'button'; reset.id = 'empty-reset';
      empty.append(node('h3', '', 'No encontramos ese producto'), node('p', '', 'Prueba con otro nombre o restablece los filtros.'), reset);
      fragment.append(empty);
    }
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
      article.dataset.cartItemId = product.id;
      const thumbnail = node('img', 'cart-thumbnail');
      Object.assign(thumbnail, { src: product.image, alt: '', width: 64, height: 64 });
      const content = node('div', 'cart-item-content');
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
      const linePrice = node('strong', 'cart-line-price');
      linePrice.append(node('span', 'sr-only', 'Importe de este producto: '), document.createTextNode(money(amountCents)));
      controls.append(label, minus, input, plus, linePrice);
      const error = node('p', 'field-error');
      error.id = `quantity-error-${product.id}`;
      error.hidden = true;
      content.append(top, node('p', 'cart-unit-price', `${money(Math.round(product.price * 100))} por unidad`), controls, error);
      article.append(thumbnail, content);
      fragment.append(article);
    }
    container.replaceChildren(fragment);
    document.getElementById('cart-empty').hidden = totals.lines.length > 0;
    document.getElementById('cart-summary').textContent = `${totals.units} ${totals.units === 1 ? 'unidad' : 'unidades'}`;
    document.querySelectorAll('[data-cart-count]').forEach((element) => { element.textContent = totals.units; });
    document.getElementById('cart-subtotal').textContent = money(totals.subtotalCents);
    document.getElementById('cart-total').textContent = money(totals.totalCents);
    document.getElementById('cart-dock-summary').textContent = totals.units ? `${totals.units} ${totals.units === 1 ? 'unidad en tu carrito' : 'unidades en tu carrito'}` : 'Tu carrito está vacío';
    document.getElementById('cart-dock-total').textContent = money(totals.totalCents);
    document.querySelectorAll('[data-open-cart]').forEach((button) => {
      const label = button.closest('#cart-dock') ? 'Ver carrito' : 'Carrito';
      button.setAttribute('aria-label', `${label}, ${totals.units} ${totals.units === 1 ? 'unidad' : 'unidades'}, total estimado ${money(totals.totalCents)}`);
    });
    const time = document.getElementById('cart-updated');
    if (updatedAt && Number.isFinite(Date.parse(updatedAt))) {
      time.dateTime = updatedAt;
      time.textContent = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(updatedAt));
    } else { time.removeAttribute('datetime'); time.textContent = 'Sin cambios'; }
    const order = document.getElementById('whatsapp-order-link');
    order.hidden = !totals.units;
    order.setAttribute('aria-label', `Consultar pedido por WhatsApp, total estimado ${money(totals.totalCents)} (se abre en una pestaña nueva)`);
    const orderForm = document.getElementById('cart-order-form');
    orderForm.hidden = !totals.units;
    order.disabled = !totals.units || !orderForm.checkValidity();
    document.getElementById('cart-clear').disabled = !totals.units;
    document.getElementById('cart-continue').textContent = totals.units ? 'Seguir viendo productos' : 'Explorar productos';
  }

  (global.Farmacia ||= {}).view = { money, renderProducts, renderCart };
})(globalThis);
