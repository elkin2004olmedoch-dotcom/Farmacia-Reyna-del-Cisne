(function (global) {
  'use strict';
  const app = global.Farmacia;
  const C = app.commerce;
  const V = app.validation;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = app.view.money;
  const params = new URLSearchParams(global.location.search);
  let products = [];
  let items = {};
  let updatedAt = null;
  const formValues = form => Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  function errors(form, issues, prefix, status) {
    for (const field of form.querySelectorAll('input, select, textarea')) {
      const message = issues[field.name];
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      const target = document.getElementById(`${prefix}-${field.name}-error`);
      if (target) { target.hidden = !message; target.textContent = message || ''; }
    }
    const keys = Object.keys(issues);
    const summary = document.getElementById(status);
    summary.replaceChildren();
    if (keys.length) {
      const p = document.createElement('p'); p.textContent = `Revisa ${keys.length} ${keys.length === 1 ? 'campo' : 'campos'} para continuar.`; summary.append(p);
      for (const key of keys) {
        const field = form.elements.namedItem(key);
        const link = document.createElement('a'); link.textContent = issues[key]; link.href = '#' + (field?.id || form.id);
        link.addEventListener('click', event => { event.preventDefault(); field?.focus?.(); }); summary.append(link);
      }
      form.elements.namedItem(keys[0])?.focus?.();
    }
    return !keys.length;
  }
  function updateHeader() {
    const user = C.currentUser();
    document.querySelectorAll('[data-account-link]').forEach(link => { link.textContent = user ? `Hola, ${user.name.split(' ')[0]}` : '♙ Ingresar'; });
    const stored = app.storage.readCart();
    const count = app.cart.totals(app.cart.normalizeStored(stored, products), products).units;
    document.querySelectorAll('[data-shop-count]').forEach(el => { el.textContent = count; });
    document.querySelectorAll('.shop-cart').forEach(el => el.setAttribute('aria-label', `Carrito, ${count} unidades`));
    const current = global.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.shop-nav a, .shop-actions a').forEach(el => { if (el.getAttribute('href') === current) el.setAttribute('aria-current', 'page'); });
  }
  function saveItems(next) {
    items = next;
    const result = app.storage.saveCart(items); updatedAt = result.updatedAt;
    updateHeader();
    if (!result.saved) $('.shop-toast').textContent = 'El carrito funciona temporalmente: el navegador bloqueó el almacenamiento.';
    global.dispatchEvent(new Event('farmacia:cart'));
  }
  function selectedIds() {
    const saved = C.read('comparison', []);
    return Array.isArray(saved) ? saved.filter(id => products.some(p => p.id === id)).slice(0, 4) : [];
  }
  function reviewsFor(id) {
    const saved = C.read('reviews', []);
    return Array.isArray(saved) ? saved.filter(r => r && r.productId === id && V.validName(r.name) && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 && typeof r.message === 'string' && r.message.length <= 1000) : [];
  }
  function productCard(p) {
    return `<article class="featured-card"><a class="featured-image" href="producto.html?id=${p.id}"><img src="${p.image}" alt="${esc(p.alt)}" loading="lazy"><span>${esc(p.badge)}</span></a><small>${esc(p.tag)}</small><h3><a href="producto.html?id=${p.id}">${esc(p.name)}</a></h3><p>${esc(p.description)}</p><div class="featured-bottom"><strong>${money(Math.round(p.price * 100))}</strong><a href="producto.html?id=${p.id}" class="text-link">Ver producto →</a></div></article>`;
  }
  function initializeProduct() {
    const area = $('#product-detail'); if (!area) return;
    const p = products.find(p => p.id === params.get('id'));
    if (!p) { area.innerHTML = '<section class="shop-panel empty-panel"><h1>Producto no encontrado.</h1><p>El enlace no corresponde a un producto de nuestro catálogo.</p><a class="button button-primary" href="catalogo.html">Explorar productos →</a></section>'; return; }
    document.title = p.name + ' | Farmacia Reina del Cisne';
    area.innerHTML = `<section class="product-detail-grid"><div><button class="product-main-image" type="button" id="zoom-product" aria-label="Ampliar imagen de ${esc(p.name)}"><img src="${p.image}" alt="${esc(p.alt)}"><span>⌕ Ampliar imagen</span></button><p class="muted">Imagen de referencia de la presentación del catálogo.</p></div><div class="product-detail-copy"><p class="eyebrow">${esc(p.tag)} <span class="product-label">${esc(p.badge)}</span></p><h1>${esc(p.name)}</h1><a class="text-link" href="#product-reviews" id="review-count"></a><div class="detail-price"><strong>${money(Math.round(p.price * 100))}</strong><span>Retiro sin costo de envío</span></div><p class="shop-lead">${esc(p.description)}</p><p class="muted">Precio de referencia · confirma disponibilidad y presentación con la farmacia.</p><form id="detail-add-form"><label for="detail-quantity">Cantidad</label><div class="quantity-picker"><button type="button" data-detail-quantity="-1" aria-label="Reducir cantidad">−</button><input id="detail-quantity" name="quantity" type="number" min="1" max="99" step="1" value="1" aria-describedby="detail-quantity-help detail-error"><button type="button" data-detail-quantity="1" aria-label="Aumentar cantidad">+</button></div><small id="detail-quantity-help">Hasta 99 unidades por producto en el carrito.</small><p id="detail-error" class="field-error" role="alert"></p><button class="button button-primary detail-add" type="submit">Añadir al carrito →</button></form><ul class="detail-benefits"><li>✚ Atención cercana en la farmacia</li><li>⌖ Retiro en tienda o entrega por coordinar</li><li>✓ Revisa tu pedido antes de confirmarlo</li></ul><a href="comparar.html" class="button button-outline">Comparar con otros productos →</a></div></section>
      <section class="related-section"><div class="shop-section-title"><div><p class="eyebrow">Completa tu cuidado</p><h2>También puedes explorar.</h2></div><a class="text-link" href="catalogo.html">Ver todos →</a></div><div class="featured-grid">${products.filter(x => x.id !== p.id).map(productCard).join('')}</div></section>
      <section class="product-info"><nav class="info-tabs" aria-label="Información del producto"><a href="#product-description">Descripción</a><a href="#product-specs">Ficha del catálogo</a><a href="#product-reviews">Opiniones</a></nav><div class="shop-panel" id="product-description"><h2>Para tu día a día.</h2><p>${esc(p.description)}</p><p>Consulta la presentación exacta, indicaciones del fabricante y disponibilidad con la farmacia antes de comprar.</p></div><div class="shop-panel" id="product-specs"><h2>Ficha del catálogo</h2><dl class="spec-list"><div><dt>Producto</dt><dd>${esc(p.name)}</dd></div><div><dt>Categoría</dt><dd>${esc(p.tag)}</dd></div><div><dt>Descripción</dt><dd>${esc(p.description)}</dd></div><div><dt>Precio de referencia</dt><dd>${money(Math.round(p.price * 100))} USD</dd></div><div><dt>Entrega</dt><dd>Retiro en farmacia o entrega por coordinar</dd></div></dl></div><div class="shop-panel" id="product-reviews"><h2>Tu opinión cuenta.</h2><p class="muted">Opiniones locales de demostración; se guardan en este navegador.</p><div id="reviews-list"></div><form id="review-form" novalidate class="shop-form form-two"><div class="shop-field"><label for="review-name">Tu nombre</label><input id="review-name" name="name" maxlength="80" aria-describedby="review-name-error" required><span id="review-name-error" class="field-error" hidden></span></div><div class="shop-field"><label for="review-rating">Tu valoración</label><select id="review-rating" name="rating" aria-describedby="review-rating-error"><option value="">Selecciona</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${n} ${n === 1 ? 'estrella' : 'estrellas'}</option>`).join('')}</select><span id="review-rating-error" class="field-error" hidden></span></div><div class="shop-field wide"><label for="review-message">Opinión</label><textarea id="review-message" name="message" minlength="10" maxlength="1000" rows="3" aria-describedby="review-message-error" required></textarea><span id="review-message-error" class="field-error" hidden></span></div><p class="form-alert wide" id="review-status" role="alert"></p><button class="button button-primary wide" type="submit">Guardar mi opinión</button></form></div></section>`;
    const quantity = $('#detail-quantity');
    document.querySelectorAll('[data-detail-quantity]').forEach(btn => btn.addEventListener('click', () => { quantity.value = Math.min(99, Math.max(1, (Number(quantity.value) || 1) + Number(btn.dataset.detailQuantity))); }));
    $('#detail-add-form').addEventListener('submit', event => {
      event.preventDefault();
      try {
        items = app.cart.normalizeStored(app.storage.readCart(), products);
        const units = Number(quantity.value);
        if (!Number.isInteger(units) || units < 1 || units > 99) throw new Error('Introduce una cantidad entera entre 1 y 99.');
        saveItems(app.cart.update(items, p.id, (items[p.id] || 0) + units, products));
        quantity.setAttribute('aria-invalid', 'false'); $('#detail-error').textContent = '';
        $('#added-summary').textContent = `${units} ${units === 1 ? 'unidad añadida' : 'unidades añadidas'}. Total del carrito: ${money(app.cart.totals(items, products).totalCents)}.`;
        $('#added-dialog').showModal();
      } catch (error) { quantity.setAttribute('aria-invalid', 'true'); $('#detail-error').textContent = error.message; quantity.focus(); }
    });
    $('#zoom-product').addEventListener('click', () => { const img = $('#zoom-image'); img.src = p.image; img.alt = p.alt; $('#zoom-dialog').showModal(); });
    function renderReviews() {
      const reviews = reviewsFor(p.id);
      $('#review-count').textContent = reviews.length ? `${(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} / 5 · ${reviews.length} opiniones locales` : 'Sé el primero en opinar →';
      $('#reviews-list').innerHTML = reviews.length ? reviews.map(r => `<article class="review-item"><strong>${esc(r.name)}</strong><span aria-label="${r.rating} de 5 estrellas">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span><p>${esc(r.message)}</p><small>Opinión local de demostración</small></article>`).join('') : '<p>Todavía no hay opiniones en este navegador.</p>';
    }
    renderReviews();
    if (C.currentUser()) $('#review-name').value = C.currentUser().name;
    $('#review-form').addEventListener('submit', event => {
      event.preventDefault(); const data = formValues(event.target); const issues = {};
      if (!V.validName(data.name)) issues.name = 'Escribe tu nombre con letras (2 a 80 caracteres).';
      if (!/^[1-5]$/.test(data.rating)) issues.rating = 'Elige una valoración de 1 a 5 estrellas.';
      if (!V.patterns.message.test(data.message)) issues.message = 'Escribe una opinión de 10 a 1000 caracteres.';
      if (!errors(event.target, issues, 'review', 'review-status')) return;
      const stored = C.read('reviews', []);
      if (!C.write('reviews', [...(Array.isArray(stored) ? stored : []), { ...data, productId: p.id, rating: Number(data.rating) }])) { $('#review-status').textContent = 'No se pudo guardar: permite el almacenamiento del navegador.'; return; }
      renderReviews(); event.target.reset(); $('#review-status').textContent = 'Tu opinión se guardó en este navegador.';
    });
  }
  function initializeCompare() {
    if (!$('#comparison')) return;
    let selected = selectedIds();
    if (selected.length < 2) selected = products.map(p => p.id).slice(0, 4);
    $('#compare-picks').innerHTML = products.map(p => `<label class="compare-pick"><input type="checkbox" value="${p.id}" ${selected.includes(p.id) ? 'checked' : ''}><img src="${p.image}" alt=""><span>${esc(p.name)}</span></label>`).join('');
    function render() {
      const chosen = products.filter(p => selected.includes(p.id));
      C.write('comparison', selected);
      if (chosen.length < 2) { $('#comparison').innerHTML = '<p class="shop-panel">Selecciona al menos dos productos para comparar.</p>'; return; }
      const row = (label, values) => `<tr><th scope="row">${label}</th>${values.map(x => `<td>${x}</td>`).join('')}</tr>`;
      $('#comparison').innerHTML = `<table class="comparison-table"><caption>Comparación de ${chosen.length} productos del catálogo</caption><thead><tr><th scope="col">Características</th>${chosen.map(p => `<th scope="col"><img src="${p.image}" alt="${esc(p.alt)}"><a href="producto.html?id=${p.id}">${esc(p.name)}</a></th>`).join('')}</tr></thead><tbody>${row('Precio de referencia',chosen.map(p=>`<strong>${money(Math.round(p.price*100))}</strong>`))}${row('Categoría',chosen.map(p=>esc(p.tag)))}${row('Presentación / descripción',chosen.map(p=>esc(p.description)))}${row('Entrega',chosen.map(()=>'Retiro o entrega por coordinar'))}${row('Opiniones locales',chosen.map(p=>reviewsFor(p.id).length || 'Sin opiniones'))}${row('Explorar',chosen.map(p=>`<a class="button button-primary" href="producto.html?id=${p.id}">Ver producto →</a>`))}</tbody></table>`;
    }
    $('#compare-picks').addEventListener('change', () => { selected = [...$('#compare-picks').querySelectorAll('input:checked')].map(el=>el.value); render(); }); render();
  }
  function initializeAccount() {
    const area = $('#account-area'); if (!area) return;
    const user = C.currentUser();
    if (user) {
      area.innerHTML = `<p class="eyebrow">Mi cuenta</p><h1>Hola, ${esc(user.name)}.</h1><p>Tu cuenta de demostración está activa en este navegador.</p><dl class="spec-list"><div><dt>Nombre</dt><dd>${esc(user.name)} ${esc(user.surname)}</dd></div><div><dt>Correo</dt><dd>${esc(user.email)}</dd></div><div><dt>Teléfono</dt><dd>${esc(user.phone)}</dd></div></dl><div class="account-links"><a class="button button-primary" href="pedidos.html">Ver mis pedidos →</a><a class="button button-outline" href="checkout.html">Continuar mi compra →</a><button class="text-link" id="logout" type="button">Cerrar sesión</button></div>`;
      $('#logout').addEventListener('click', () => { C.logout(); global.location.reload(); }); return;
    }
    const show = register => { $('#login-panel').hidden = register; $('#register-panel').hidden = !register; (register ? $('#register-name') : $('#login-email')).focus(); };
    $('#show-register').addEventListener('click', () => show(true)); $('#show-login').addEventListener('click', () => show(false));
    document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
      const visible = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(visible)); button.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
      button.dataset.password.split(',').forEach(id => { document.getElementById(id).type = visible ? 'text' : 'password'; });
    }));
    $('#register-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.target; const values = formValues(form);
      // Las contraseñas se comparan literalmente, no se recortan.
      values.password = form.elements.password.value; values.confirm = form.elements.confirm.value;
      if (!errors(form, V.validateRegistration(values), 'register', 'register-status')) return;
      const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
      try { await C.register(values); global.location.href = params.get('next') === 'checkout' ? 'checkout.html?step=delivery' : 'cuenta.html'; }
      catch (error) { $('#register-status').textContent = error.message; } finally { submit.disabled = false; }
    });
    $('#login-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.target; const values = formValues(form); const issues = {};
      if (!V.validEmail(values.email)) issues.email = 'Escribe un correo válido.';
      if (!form.elements.password.value) issues.password = 'Escribe tu contraseña.';
      if (!errors(form, issues, 'login', 'login-status')) return;
      const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
      try { await C.login(values.email, form.elements.password.value); global.location.href = params.get('next') === 'checkout' ? 'checkout.html?step=delivery' : 'cuenta.html'; }
      catch (error) { $('#login-status').textContent = error.message; } finally { submit.disabled = false; }
    });
    if (params.get('register') === '1') show(true);
  }
  function orderHTML(order) {
    const date = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(order.createdAt));
    return `<div class="order-id"><div><p class="eyebrow">Pedido ${esc(order.id)}</p><p>${esc(date)} · hora de Ecuador continental</p></div><span class="product-label">Registrado en este dispositivo</span></div><ol class="order-timeline"><li class="current"><b>✓</b><strong>Registrado</strong><small>Demostración local</small></li><li><b>2</b><strong>Confirmación de la farmacia</strong><small>Consulta por WhatsApp</small></li><li><b>3</b><strong>Preparación y entrega</strong><small>Pendiente de coordinar</small></li></ol><ul class="order-lines">${order.lines.map(line=>`<li><span>${line.quantity} × ${esc(line.name)}</span><strong>${money(line.amountCents)}</strong></li>`).join('')}</ul><dl class="spec-list"><div><dt>Entrega</dt><dd>${order.buyer.delivery === 'pickup' ? 'Retiro en farmacia' : esc([order.buyer.province, order.buyer.city, order.buyer.address].join(', '))}</dd></div><div><dt>Pago</dt><dd>${order.payment.method === 'card' ? `Simulación ${esc(order.payment.brand)} •••• ${esc(order.payment.last4)} · sin cobro` : 'Por coordinar con la farmacia'}</dd></div><div><dt>Total estimado</dt><dd><strong>${money(order.totalCents)}</strong></dd></div></dl><a class="button button-primary" href="https://wa.me/593979275988?text=${encodeURIComponent(C.whatsappMessage(order))}" target="_blank" rel="noopener noreferrer">Consultar este pedido por WhatsApp ↗</a><button class="button button-outline" type="button" data-download-order="${esc(order.id)}">Descargar resumen</button>`;
  }
  function initializeCheckout() {
    if (!$('#checkout-items')) return;
    let step = 0; let buyer; let placed = false;
    const title = ['Tu carrito.', 'Tu cuidado, a tu manera.', 'Un último paso.', 'Tu pedido está registrado.'];
    const deliveryForm = $('#delivery-form'); const paymentForm = $('#payment-form');
    const user = C.currentUser();
    if (user) { deliveryForm.elements.name.value = `${user.name} ${user.surname}`; deliveryForm.elements.email.value = user.email; deliveryForm.elements.phone.value = user.phone; }
    else $('#checkout-cart').insertAdjacentHTML('afterbegin','<div class="guest-note"><p>Puedes comprar como invitado o guardar tus pedidos en una cuenta local.</p><a href="cuenta.html?next=checkout" class="text-link">Iniciar sesión / Crear cuenta →</a></div>');
    V.provinces.forEach(province => { const option = document.createElement('option'); option.value = province; option.textContent = province; $('#checkout-province').append(option); });
    function go(next) {
      step = next;
      document.querySelectorAll('[data-checkout-step]').forEach(el => { el.hidden = Number(el.dataset.checkoutStep) !== step; });
      document.querySelectorAll('[data-step-label]').forEach(el => { el.removeAttribute('aria-current'); el.classList.toggle('complete', Number(el.dataset.stepLabel) < step); if (Number(el.dataset.stepLabel) === step) el.setAttribute('aria-current','step'); });
      $('#checkout-title').textContent = title[step]; $('#checkout-next').hidden = step !== 0;
      $('#checkout-title').focus();
    }
    function renderCart() {
      const totals = app.cart.totals(items, products);
      $('#checkout-items').innerHTML = totals.units ? totals.lines.map(({product:p,quantity,amountCents})=>`<article class="checkout-cart-item"><a href="producto.html?id=${p.id}"><img src="${p.image}" alt="${esc(p.alt)}"></a><div><small>${esc(p.tag)}</small><h2><a href="producto.html?id=${p.id}">${esc(p.name)}</a></h2><p>${money(Math.round(p.price*100))} por unidad</p><a class="text-link" href="producto.html?id=${p.id}">Ver presentación →</a></div><div class="quantity-picker"><button type="button" data-order-qty="${p.id}" data-delta="-1" aria-label="Reducir ${esc(p.name)}" ${quantity<=1?'disabled':''}>−</button><label class="sr-only" for="order-qty-${p.id}">Cantidad de ${esc(p.name)}</label><input id="order-qty-${p.id}" data-order-input="${p.id}" type="number" value="${quantity}" min="1" max="99" step="1" aria-describedby="checkout-cart-status"><button type="button" data-order-qty="${p.id}" data-delta="1" aria-label="Aumentar ${esc(p.name)}" ${quantity>=99?'disabled':''}>+</button></div><div><strong>${money(amountCents)}</strong><button class="text-link remove-order-item" type="button" data-order-remove="${p.id}">Quitar</button></div></article>`).join('') : '<section class="shop-panel empty-panel"><span class="empty-icon" aria-hidden="true">＋</span><h2>Tu carrito está esperando.</h2><p>Encuentra algo para tu cuidado y añádelo para empezar.</p><a href="catalogo.html" class="button button-primary">Explorar productos →</a></section>';
      $('#checkout-summary').innerHTML = `<dl class="summary-totals"><div><dt>Productos</dt><dd>${totals.units}</dd></div><div><dt>Subtotal</dt><dd>${money(totals.subtotalCents)}</dd></div><div><dt>${deliveryForm.elements.delivery.value === 'delivery' ? 'Entrega' : 'Retiro en farmacia'}</dt><dd>${deliveryForm.elements.delivery.value === 'delivery' ? 'Por cotizar' : 'Sin costo'}</dd></div><div class="summary-total"><dt>Total estimado</dt><dd>${money(totals.totalCents)}</dd></div></dl>`;
      $('#checkout-next').disabled = !totals.units;
    }
    function refreshCart() { items = app.cart.normalizeStored(app.storage.readCart(), products); renderCart(); }
    $('#checkout-next').addEventListener('click', () => { refreshCart(); if (Object.keys(items).length) go(1); });
    $('#checkout-items').addEventListener('click', event => {
      const quantity = event.target.closest('[data-order-qty]'); const remove = event.target.closest('[data-order-remove]');
      if (quantity) {
        try { saveItems(app.cart.update(items, quantity.dataset.orderQty, items[quantity.dataset.orderQty] + Number(quantity.dataset.delta), products)); renderCart(); document.querySelector(`[data-order-qty="${quantity.dataset.orderQty}"][data-delta="${quantity.dataset.delta}"]`)?.focus(); $('#checkout-cart-status').textContent = 'Cantidad y total actualizados.'; }
        catch(error) { $('#checkout-cart-status').textContent = error.message; }
      }
      if (remove) {
        $('#shop-remove-name').textContent = `¿Quitar ${products.find(p=>p.id===remove.dataset.orderRemove).name} de tu carrito?`;
        $('#shop-remove-dialog').dataset.product = remove.dataset.orderRemove; $('#shop-remove-dialog').showModal();
      }
    });
    $('#shop-remove-confirm').addEventListener('click', () => { saveItems(app.cart.remove(items, $('#shop-remove-dialog').dataset.product)); $('#shop-remove-dialog').close(); renderCart(); ($('#checkout-items input') || $('#checkout-items a')).focus(); });
    $('#checkout-items').addEventListener('change', event => {
      if (!event.target.dataset.orderInput) return;
      try { saveItems(app.cart.update(items, event.target.dataset.orderInput, event.target.value, products)); renderCart(); $('#checkout-cart-status').textContent = 'Cantidad y total actualizados.'; }
      catch (error) { event.target.setAttribute('aria-invalid','true'); $('#checkout-cart-status').textContent = error.message; event.target.focus(); }
    });
    document.querySelectorAll('[data-checkout-back]').forEach(el => el.addEventListener('click', () => { if (!placed) go(Number(el.dataset.checkoutBack)); }));
    deliveryForm.addEventListener('change', event => {
      if (event.target.name === 'delivery') { $('#delivery-address').hidden = deliveryForm.elements.delivery.value !== 'delivery'; renderCart(); }
      if (event.target.name === 'documentType') { $('#checkout-document').maxLength = event.target.value === 'ruc' ? 13 : 10; }
    });
    deliveryForm.addEventListener('submit', event => {
      event.preventDefault(); const values = formValues(deliveryForm);
      if (!errors(deliveryForm, V.validateCheckout(values), 'checkout', 'delivery-status')) return;
      refreshCart(); if (!Object.keys(items).length) { go(0); return; }
      buyer = values; go(2);
    });
    paymentForm.addEventListener('change', event => { if (event.target.name === 'payment') { $('#card-fields').hidden = paymentForm.elements.payment.value !== 'card'; $('#place-order').textContent = paymentForm.elements.payment.value === 'card' ? 'Simular pago y registrar pedido →' : 'Registrar pedido →'; } });
    $('#payment-cardNumber').addEventListener('input', event => { const brand = V.cardBrand(event.target.value); $('#card-brand').textContent = brand ? `Formato ${brand} detectado. Se comprobará el verificador al confirmar.` : 'Visa o Mastercard de prueba'; });
    $('#fill-test-card').addEventListener('click', () => { $('#payment-holder').value = 'Cliente de Prueba'; $('#payment-cardNumber').value = '4000 0021 8000 0000'; $('#payment-expiry').value = '12/' + String(new Date().getFullYear() + 2).slice(-2); $('#payment-cvv').value = '123'; $('#card-brand').textContent = 'Visa de prueba para Ecuador'; errors(paymentForm, {}, 'payment', 'payment-status'); });
    paymentForm.addEventListener('submit', event => {
      event.preventDefault(); if (placed || !buyer) return;
      const values = formValues(paymentForm); const issues = values.payment === 'card' ? V.validateCard(values) : {};
      if (!values.terms) issues.terms = 'Acepta las condiciones después de revisar tu pedido.';
      if (!errors(paymentForm, issues, 'payment', 'payment-status')) return;
      $('#place-order').disabled = true;
      try {
        const before = JSON.stringify(items); refreshCart();
        if (JSON.stringify(items) !== before) throw new Error('El carrito cambió en otra pestaña. Vuelve al carrito y revisa el total antes de confirmar.');
        const order = C.createOrder(items, products, buyer, values.payment, values);
        placed = true; buyer = null;
        paymentForm.reset(); deliveryForm.elements.document.value = '';
        for (const id of ['payment-holder','payment-cardNumber','payment-expiry','payment-cvv']) document.getElementById(id).value = '';
        $('#order-confirmation').innerHTML = `<span class="confirmation-check" aria-hidden="true">✓</span><h2>¡Gracias por elegirnos!</h2><p>Tu pedido de demostración está guardado. La farmacia aún debe confirmar disponibilidad y entrega. No se realizó ningún cobro.</p>${orderHTML(order)}<a href="pedidos.html" class="text-link">Ver mis pedidos →</a>`;
        go(3); updateHeader(); $('#checkout-summary').innerHTML = `<p>Pedido ${esc(order.id)}</p><dl class="summary-totals"><div class="summary-total"><dt>Total estimado</dt><dd>${money(order.totalCents)}</dd></div></dl><p class="muted">Registrado localmente · sin cobro real</p>`;
      } catch (error) { $('#payment-status').textContent = error.message; $('#place-order').disabled = false; }
    });
    renderCart();
    if (params.get('step') === 'delivery' && Object.keys(items).length) go(1);
    global.addEventListener('storage', event => { if (!placed && event.key === 'farmacia-reina-cart') { refreshCart(); if (!Object.keys(items).length) go(0); } });
  }
  async function initialize() {
    document.body.insertAdjacentHTML('beforeend', `<p class="shop-toast sr-only" role="status" aria-live="polite"></p><dialog class="shop-dialog" id="added-dialog" aria-labelledby="added-title"><span class="confirmation-check" aria-hidden="true">✓</span><h2 id="added-title">¡Añadido a tu carrito!</h2><p id="added-summary"></p><div class="dialog-actions"><button type="button" class="button button-outline" data-shop-close>Seguir comprando</button><a href="checkout.html" class="button button-primary">Ver carrito →</a></div></dialog><dialog class="shop-dialog image-dialog" id="zoom-dialog" aria-label="Imagen ampliada del producto"><button class="cart-close" type="button" data-shop-close aria-label="Cerrar imagen">×</button><img id="zoom-image" alt=""></dialog><dialog class="shop-dialog" id="shop-remove-dialog" aria-labelledby="shop-remove-title"><h2 id="shop-remove-title">¿Quitar del carrito?</h2><p id="shop-remove-name"></p><div class="dialog-actions"><button class="button button-outline" type="button" data-shop-close autofocus>Cancelar</button><button class="button button-primary" id="shop-remove-confirm" type="button">Sí, quitar</button></div></dialog>`);
    document.addEventListener('click', event => { const close = event.target.closest('[data-shop-close]'); if (close) close.closest('dialog').close(); });
    // Limpia un error al editar, sin esconder los demás errores del formulario.
    document.addEventListener('input', event => { const input = event.target; if (!input.id || !input.closest('.shop-form')) return; input.removeAttribute('aria-invalid'); const message = document.getElementById(input.id + '-error'); if (message) message.hidden = true; });
    try {
      products = await app.repo.loadProducts();
      const stored = app.storage.readCart(); items = app.cart.normalizeStored(stored, products); updatedAt = stored.updatedAt;
      updateHeader();
      global.addEventListener('farmacia:cart', updateHeader); global.addEventListener('storage', updateHeader);
      if ($('#featured-products')) $('#featured-products').innerHTML = products.slice(0,4).map(productCard).join('');
      initializeProduct(); initializeCompare(); initializeAccount(); initializeCheckout();
      if ($('#orders-list')) {
        const orders = C.orders().reverse();
        $('#orders-list').innerHTML = orders.length ? orders.map(order => `<article class="shop-panel order-card">${orderHTML(order)}</article>`).join('') : `<section class="shop-panel empty-panel"><span class="empty-icon" aria-hidden="true">▣</span><h2>Aún no tienes pedidos aquí.</h2><p>Los pedidos aparecen en la cuenta que los creó. Los pedidos de invitado se muestran durante esta sesión.</p><a class="button button-primary" href="catalogo.html">Explorar productos →</a><a class="button button-outline" href="cuenta.html">Iniciar sesión</a></section>`;
      }
    } catch(error) { const area = $('#product-detail') || $('#checkout-items') || $('#orders-list') || $('#comparison'); if (area) area.textContent = 'No se pudo abrir la tienda. ' + error.message; $('.shop-toast').textContent = error.message; }
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-download-order]'); if (!button) return;
      const order = C.orders().find(order=>order.id===button.dataset.downloadOrder); if (!order) return;
      const data = { pedido: order.id, demostracion: true, fecha: order.createdAt, moneda: 'USD', productos: order.lines.map(({name,quantity,amountCents})=>({nombre:name,cantidad:quantity,subtotal:amountCents/100})), total: order.totalCents/100, pago: order.payment.status };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const link = document.createElement('a'); link.href=url; link.download=order.id+'.json'; link.click(); global.setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  initialize();
})(globalThis);
