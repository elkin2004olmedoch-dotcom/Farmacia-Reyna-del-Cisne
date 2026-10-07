(function (global) {
  'use strict';
  const prefix = 'farmacia-shop-';
  const memory = new Map();
  function read(key, fallback, session = false) {
    try { return JSON.parse(global[session ? 'sessionStorage' : 'localStorage'].getItem(prefix + key)) ?? fallback; }
    catch (_) { return memory.get(key) ?? fallback; }
  }
  function write(key, value, session = false) {
    memory.set(key, value);
    try { global[session ? 'sessionStorage' : 'localStorage'].setItem(prefix + key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  const list = key => { const value = read(key, []); return Array.isArray(value) ? value.filter(x => x && typeof x === 'object') : []; };
  const accounts = () => list('accounts').filter(x => global.Farmacia.validation.validEmail(x.email)
    && global.Farmacia.validation.validName(x.name) && global.Farmacia.validation.validName(x.surname)
    && global.Farmacia.validation.normalizePhone(x.phone) && /^[a-f0-9]{64}$/.test(x.hash) && /^[a-f0-9]{32}$/.test(x.salt));
  function currentUser() {
    const email = read('session', null, true);
    const account = accounts().find(x => x.email === email);
    if (!account) return null;
    return { email: account.email, name: account.name, surname: account.surname, phone: account.phone };
  }
  const encode = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  async function passwordHash(password, salt) {
    if (!global.crypto?.subtle) throw new Error('Para crear una cuenta, abre el proyecto desde localhost o HTTPS en un navegador actual.');
    const key = await global.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 210000, hash: 'SHA-256' }, key, 256);
    return encode(new Uint8Array(bits));
  }
  async function register(values) {
    const errors = global.Farmacia.validation.validateRegistration(values);
    if (Object.keys(errors).length) throw new Error('Revisa los datos del registro.');
    const email = values.email.trim().toLowerCase();
    const users = accounts();
    if (users.some(x => x.email === email)) throw new Error('Este correo ya tiene una cuenta en este navegador. Inicia sesión.');
    const salt = encode(global.crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(values.password, salt);
    const user = { name: values.name.trim(), surname: values.surname.trim(), email, phone: global.Farmacia.validation.normalizePhone(values.phone), salt, hash };
    if (!write('accounts', [...users, user])) throw new Error('El navegador bloqueó el almacenamiento. Permítelo para guardar la cuenta.');
    write('session', email, true);
    return currentUser();
  }
  async function login(email, password) {
    const user = accounts().find(x => x.email === email.trim().toLowerCase());
    if (!user || await passwordHash(password, user.salt) !== user.hash) throw new Error('El correo o la contraseña no coinciden con una cuenta de este navegador.');
    write('session', user.email, true);
    return currentUser();
  }
  const logout = () => write('session', null, true);
  function orders() {
    const owner = currentUser()?.email;
    const guestIds = read('guest-orders', [], true);
    return list('orders').filter(x => /^RC-[A-F0-9]{8}$/.test(x.id) && Number.isFinite(Date.parse(x.createdAt))
      && x.buyer && global.Farmacia.validation.validName(x.buyer.name) && global.Farmacia.validation.validEmail(x.buyer.email)
      && global.Farmacia.validation.normalizePhone(x.buyer.phone) && ['pickup','delivery'].includes(x.buyer.delivery)
      && x.payment && ['card','store'].includes(x.payment.method) && Array.isArray(x.lines) && x.lines.length
      && x.lines.every(line => line && typeof line.name === 'string' && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isInteger(line.amountCents) && line.amountCents >= 0)
      && Number.isInteger(x.totalCents) && x.totalCents >= 0
      && (owner ? x.owner === owner : !x.owner && Array.isArray(guestIds) && guestIds.includes(x.id)));
  }
  const testCards = ['4000002180000000', '4242424242424242', '5555555555554444', '2223003122003222'];
  function createOrder(items, products, buyer, payment, card = {}) {
    if (Object.keys(global.Farmacia.validation.validateCheckout(buyer)).length) throw new Error('Revisa los datos del comprador.');
    if (!['store', 'card'].includes(payment)) throw new Error('Selecciona un método de pago.');
    const totals = global.Farmacia.cart.totals(items, products);
    if (!totals.units) throw new Error('Tu carrito está vacío.');
    if (payment === 'card') {
      if (Object.keys(global.Farmacia.validation.validateCard(card)).length) throw new Error('Revisa los datos de la tarjeta.');
      if (!testCards.includes(String(card.cardNumber).replace(/[ -]/g, ''))) throw new Error('La simulación acepta solo las tarjetas de prueba indicadas. Usa la tarjeta de Ecuador 4000 0021 8000 0000.');
    }
    const order = {
      id: 'RC-' + global.crypto.randomUUID().slice(0, 8).toUpperCase(),
      createdAt: new Date().toISOString(), owner: currentUser()?.email ?? null,
      status: 'registered', demo: true,
      buyer: { name: buyer.name.trim(), email: buyer.email.trim(), phone: global.Farmacia.validation.normalizePhone(buyer.phone), delivery: buyer.delivery,
        province: buyer.delivery === 'delivery' ? buyer.province : '', city: buyer.delivery === 'delivery' ? buyer.city.trim() : '', address: buyer.delivery === 'delivery' ? buyer.address.trim() : 'Retiro en farmacia' },
      documentMasked: '••••••' + String(buyer.document).slice(-4),
      payment: payment === 'card' ? { method: 'card', brand: global.Farmacia.validation.cardBrand(card.cardNumber), last4: String(card.cardNumber).replace(/[ -]/g, '').slice(-4), status: 'simulated' } : { method: 'store', status: 'pending' },
      lines: totals.lines.map(({ product, quantity, amountCents }) => ({ id: product.id, name: product.name, image: product.image, quantity, amountCents })),
      totalCents: totals.totalCents,
    };
    if (!write('orders', [...list('orders'), order])) throw new Error('No pudimos guardar el pedido. El carrito se conserva; permite el almacenamiento e intenta otra vez.');
    if (!order.owner) {
      const guestIds = read('guest-orders', [], true);
      write('guest-orders', [...(Array.isArray(guestIds) ? guestIds : []), order.id], true);
    }
    global.Farmacia.storage.saveCart({});
    return order;
  }
  function whatsappMessage(order) {
    return [`Hola, quiero consultar este pedido ${order.id}.`, `Comprador: ${order.buyer.name}`, `Teléfono: ${order.buyer.phone}`, `Correo: ${order.buyer.email}`,
      order.buyer.delivery === 'pickup' ? 'Retiro en farmacia.' : `Entrega por coordinar: ${order.buyer.province}, ${order.buyer.city}, ${order.buyer.address}`,
      ...order.lines.map(x => `${x.quantity} × ${x.name}: ${global.Farmacia.view.money(x.amountCents)}`),
      `Total estimado: ${global.Farmacia.view.money(order.totalCents)}`, 'Por favor, confirmen disponibilidad, entrega y precio final. El sitio no ha realizado ningún cobro.'].join('\n');
  }
  const api = { read, write, currentUser, register, login, logout, orders, createOrder, whatsappMessage, testCards };
  (global.Farmacia ||= {}).commerce = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
