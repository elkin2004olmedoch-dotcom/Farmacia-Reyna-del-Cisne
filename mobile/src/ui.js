import {createRouteMap} from '../../frontend/controllers/route-map.js';
const deliveryLabels = {asignada: 'Asignada', en_camino: 'En camino', en_destino: 'En destino', entregada: 'Entregada', cancelada: 'Cancelada'};
const nextStates = {asignada: 'en_camino', en_camino: 'en_destino', en_destino: 'entregada'};
const actionLabels = {en_camino: 'Iniciar recorrido', en_destino: 'Llegué al destino', entregada: 'Pedido entregado'};
const trackingLabels = {idle: 'Ubicación detenida', starting: 'Preparando ubicación…', sharing: 'Compartiendo ubicación', offline: 'Sin conexión', stale: 'Sin ubicación reciente', 'permission-denied': 'Permiso de ubicación retirado', closed: 'Seguimiento finalizado', error: 'Ubicación interrumpida', reconnecting: 'Recuperando conexión…'};
const inRoute = delivery => ['en_camino', 'en_destino'].includes(delivery?.estado);
const isOpen = delivery => ['asignada', 'en_camino', 'en_destino'].includes(delivery?.estado);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function button(text, action, secondary = false) {
  const element = node('button', secondary ? 'secondary' : '', text);
  element.type = 'button';
  element.dataset.action = action;
  return element;
}
function elapsed(value) {
  const date = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(date)) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  return seconds < 60 ? `hace ${seconds} s` : `hace ${Math.floor(seconds / 60)} min`;
}

export async function mountApp({root, session, tracker, runtime}) {
  let user = null, page = 1, filter = '', result = {items: [], total: 0, page: 1, pageSize: 20};
  let busy = false, disposed = false, pendingRefresh = false, notificationDenied = false, loadedFilter = '', tracking = {...tracker.state};
  const elements = {};
  let routeMap=null,routeId=null,routeGeneration=0;
  function closeRoute(){routeGeneration++;routeMap?.dispose();routeMap=null;routeId=null;if(elements.routePanel)elements.routePanel.hidden=true;}
  async function openRoute(item){
    closeRoute();if(!item?.destino)return;
    const generation=routeGeneration;routeId=item.id;elements.routePanel.hidden=false;
    elements.routeTitle.textContent='Tu recorrido · pedido '+String(item.pedidoId).slice(0,8);
    const map=await createRouteMap(elements.route,{destination:item.destino,requestRoute:input=>session.request('/entregas/'+encodeURIComponent(item.id)+'/ruta',{method:'POST',data:input}),assetBase:new URL('./assets/leaflet/',document.baseURI)});
    if(disposed || !user || generation!==routeGeneration){map.dispose();return;}routeMap=map;
    if(tracking.activeId===item.id && tracking.position)map.update(tracking.position);else if(item.ubicacion)map.update(item.ubicacion);
    elements.routeTitle.focus();
  }

  function message(text = '', error = false) {
    elements.message.textContent = text;
    elements.message.classList.toggle('is-error', error);
  }
  function setBusy(value) {
    busy = value;
    elements.main.setAttribute('aria-busy', String(value));
    for (const control of root.querySelectorAll('button, input, select')) control.disabled = value || control.dataset.unavailable === 'true';
  }
  function renderShell() {
    const skip = node('a', 'skip-link', 'Saltar al contenido'); skip.href = '#contenido';
    const header = node('header', 'app-header'), brand = node('div', 'brand');
    const logo = node('img'); logo.src = './assets/logo-reina-del-cisne.png'; logo.alt = ''; logo.width = 64; logo.height = 64;
    const copy = node('div', 'brand-copy');
    copy.append(node('span', 'brand-name', 'Farmacia Reina del Cisne'), node('span', 'brand-detail', 'REPARTO · PUERTO QUITO'));
    brand.append(logo, copy); header.append(brand);
    elements.main = node('main', 'app-main'); elements.main.id = 'contenido'; elements.main.tabIndex = -1;
    elements.message = node('p', 'status-message'); elements.message.id = 'app-message'; elements.message.setAttribute('role', 'status'); elements.message.setAttribute('aria-live', 'polite');
    elements.network = node('p', 'network-status', 'Sin conexión. Actualiza al recuperar la red; la última ubicación puede quedar pendiente.');
    elements.network.setAttribute('role', 'status'); elements.network.hidden = navigator.onLine;
    root.replaceChildren(skip, header, elements.main);
    elements.main.append(elements.network);
  }
  function renderLogin(text = '') {
    closeRoute();
    user = null; result.items = []; tracking = {...tracker.state};
    renderShell();
    const intro = node('section', 'intro');
    intro.append(node('p', 'eyebrow', 'Tu app de reparto'), node('h1', '', 'Tu ruta comienza aquí.'), node('p', 'muted', 'Accede con la cuenta de repartidor que te asignó la farmacia.'));
    const form = node('form', 'panel login-panel'); form.dataset.login = 'true'; form.noValidate = true;
    form.setAttribute('aria-describedby', 'app-message');
    for (const [name, label, type, autocomplete] of [['email', 'Correo electrónico', 'email', 'username'], ['password', 'Contraseña', 'password', 'current-password']]) {
      const field = node('div', 'field'), input = node('input'), caption = node('label', '', label);
      input.id = 'login-' + name; input.name = name; input.type = type; input.autocomplete = autocomplete; input.required = true;
      input.maxLength = name === 'email' ? 254 : 128;
      if (name === 'email') { input.inputMode = 'email'; input.spellcheck = false; input.autocapitalize = 'none'; }
      caption.htmlFor = input.id; field.append(caption, input); form.append(field);
    }
    const submit = button('Iniciar sesión', 'login'); submit.type = 'submit'; form.append(submit);
    const retry = button('Reintentar sesión guardada', 'restore', true);
    form.append(retry, node('p', 'help', 'Solo para repartidores autorizados. La sesión se protege en el almacén cifrado del teléfono.'));
    elements.main.append(intro, elements.message, form, node('p', 'help privacy-note', 'La ubicación se comparte por decisión tuya durante una entrega. Puedes detenerla en cualquier momento.'));
    message(text, Boolean(text));
  }
  function renderWorkspace() {
    renderShell();
    const intro = node('section', 'intro');
    intro.append(node('p', 'eyebrow', 'Bandeja de reparto'), node('h1', '', 'Tus entregas'), node('p', 'muted', user.nombre || 'Repartidor'));
    const toolbar = node('div', 'toolbar'); toolbar.append(button('Actualizar entregas', 'refresh', true), button('Cerrar sesión', 'logout', true));
    elements.routePanel=node('section','panel');elements.routePanel.hidden=true;
    elements.routeTitle=node('h2','','Tu recorrido');elements.routeTitle.tabIndex=-1;
    elements.route=node('div');elements.routePanel.append(elements.routeTitle,button('Cerrar mapa','close-map',true),elements.route);
    const gps = node('section', 'panel tracking-panel'); gps.setAttribute('aria-labelledby', 'tracking-heading');
    const heading = node('h2', 'eyebrow', 'Ubicación del reparto'); heading.id = 'tracking-heading';
    elements.trackingTitle = node('p', 'tracking-title'); elements.trackingTitle.setAttribute('role', 'status');
    elements.trackingMessage = node('p', 'help'); elements.trackingMeta = node('p', 'tracking-meta muted');
    elements.settings = button('Abrir permisos del teléfono', 'settings', true);
    gps.append(heading, elements.trackingTitle, elements.trackingMessage, node('p', 'help', 'Iniciar recorrido solicita compartir ubicación durante la entrega, también con pantalla bloqueada si el teléfono lo permite. Puedes detenerla aquí.'), elements.trackingMeta, elements.settings);
    const field = node('div', 'field'), label = node('label', '', 'Estado de la entrega'); label.htmlFor = 'delivery-filter';
    elements.filter = node('select'); elements.filter.id = 'delivery-filter'; elements.filter.name = 'estado';
    for (const [value, text] of [['', 'Todas las entregas'], ...Object.entries(deliveryLabels)]) { const option = node('option', '', text); option.value = value; elements.filter.append(option); }
    elements.filter.value = filter; field.append(label, elements.filter);
    elements.list = node('ul', 'deliveries'); elements.list.setAttribute('aria-label', 'Entregas asignadas');
    elements.pager = node('nav', 'pager'); elements.pager.setAttribute('aria-label', 'Páginas de entregas');
    elements.main.append(intro, toolbar, elements.network, elements.message, elements.routePanel, gps, field, elements.list, elements.pager, node('p', 'help privacy-note', 'El GPS depende de los permisos, la señal, la batería y las restricciones del teléfono. No se calcula una hora de llegada.'));
    renderList(); updateTracking(tracking);
  }
  function renderList() {
    if (!elements.list || !user) return;
    if(routeId && !result.items.some(item=>item.id===routeId && isOpen(item)))closeRoute();
    const focusedId = document.activeElement?.id;
    const cards = result.items.map(item => {
      const li = node('li'), card = node('article', 'panel delivery-card' + (isOpen(item) ? '' : ' is-closed'));
      card.dataset.delivery = item.id;
      const heading = node('div', 'card-heading');
      heading.append(node('h2', '', 'Pedido ' + String(item.pedidoId).slice(0, 8)), node('span', 'badge', deliveryLabels[item.estado] || 'Estado por verificar')); card.append(heading);
      // Closed deliveries never expose contact details, even if an old response includes them.
      const destination = isOpen(item) ? item.destino : null;
      if (destination) {
        const address = node('div', 'destination');
        address.append(node('strong', '', destination.nombre), node('p', 'address', destination.direccion), node('p', 'help', [destination.ciudad, destination.provincia].filter(Boolean).join(', '))); card.append(address);
        const links = node('div', 'card-links'),mapButton=button('Ver ruta en la app','map',true);mapButton.dataset.id=item.id;links.append(mapButton);
        const phone = String(destination.telefono || '').replace(/[^+\d]/g, '');
        if (item.estado === 'en_destino' && /^\+?\d{7,15}$/.test(phone)) { const call = node('a', 'button', 'Llamar al destinatario'); call.href = 'tel:' + phone; links.append(call); }
        card.append(links);
      } else card.append(node('p', 'muted', 'Entrega cerrada. Los datos del destino ya no se muestran.'));
      const actions = node('div', 'card-actions'), next = nextStates[item.estado];
      if (next) {
        const change = button(actionLabels[next], 'state'); change.dataset.id = item.id; change.dataset.state = next; change.id = 'state-' + item.id;
        change.dataset.unavailable = String(next === 'en_camino' && (item.estadoPedido !== 'preparado' || Boolean(tracking.activeId && tracking.activeId!==item.id))); change.disabled = change.dataset.unavailable === 'true'; actions.append(change);
        if (change.disabled) card.append(node('p', 'help', 'La farmacia debe preparar el pedido antes de tu salida.'));
      }
      if (inRoute(item)) { const gps = button(tracking.activeId === item.id ? 'Detener ubicación' : 'Compartir ubicación', 'gps', true); gps.dataset.id = item.id; gps.id = 'gps-' + item.id; actions.append(gps); }
      if (actions.childElementCount) card.append(actions);
      li.append(card); return li;
    });
    elements.list.replaceChildren(...cards);
    if (!cards.length) { const empty = node('li', 'panel empty', 'No hay entregas en esta página. Actualiza para consultar nuevas asignaciones.'); elements.list.append(empty); }
    const previous = button('Página anterior', 'previous', true), next = button('Siguiente página', 'next', true);
    previous.dataset.unavailable = String(page <= 1); next.dataset.unavailable = String(page * 20 >= result.total);
    previous.disabled = previous.dataset.unavailable === 'true'; next.disabled = next.dataset.unavailable === 'true';
    previous.id = 'page-previous'; next.id = 'page-next';
    elements.pager.replaceChildren(node('p', 'muted', `Página ${page} · ${result.total} entregas`), previous, next);
    setBusy(busy);
    if (focusedId) document.getElementById(focusedId)?.focus();
  }
  function updateTracking(status) {
    if (disposed) return;
    tracking = {...status};
    if(routeId===status.activeId)routeMap?.update(status.position||null);
    else if(!status.activeId)routeMap?.update(null);
    if (!user || !elements.trackingTitle) return;
    elements.trackingTitle.textContent = trackingLabels[status.phase] || 'Estado de ubicación por verificar';
    elements.trackingMessage.textContent = status.message || (status.activeId ? 'Solo se comparte la posición durante tu entrega activa.' : 'Pulsa Compartir ubicación en una entrega en camino. Se solicitarán permisos y se mostrará el aviso del teléfono.');
    const sent = elapsed(status.lastSentAt), captured = elapsed(status.lastCapturedAt);
    const precision = typeof status.precision === 'number' && Number.isFinite(status.precision) ? `Precisión indicada: ${Math.round(status.precision)} m.` : '';
    elements.trackingMeta.textContent = [sent ? `Último envío ${sent}.` : 'Todavía no se ha enviado una ubicación.', captured ? `Última captura ${captured}.` : '', precision].filter(Boolean).join(' ');
    elements.settings.hidden = status.phase !== 'permission-denied' && !notificationDenied;
    for (const control of root.querySelectorAll('[data-action="gps"]')) {
      control.textContent = tracking.activeId === control.dataset.id ? 'Detener ubicación' : 'Compartir ubicación';
      control.dataset.unavailable = String(Boolean(tracking.activeId && tracking.activeId !== control.dataset.id));
      control.disabled = busy || control.dataset.unavailable === 'true';
    }
  }
  async function refresh() {
    try {
      await tracker.reconcile();
      const response = await session.request(`/entregas?page=${page}&pageSize=20${filter ? '&estado=' + encodeURIComponent(filter) : ''}`);
      if (!Array.isArray(response?.items)) throw new Error('Invalid deliveries response');
      result = response; loadedFilter = filter;
    } catch (error) {
      page = result.page; filter = loadedFilter;
      if (elements.filter) elements.filter.value = filter;
      throw error;
    }
    renderList(); updateTracking(tracker.state);
  }
  async function acceptUser(profile) {
    if (!profile || profile.role !== 'repartidor' || profile.activo === false) {
      if (profile) { await tracker.stop(); await session.logout(); }
      renderLogin(profile ? 'Esta app requiere una cuenta de repartidor activa.' : '');
      return;
    }
    user = profile; page = 1; filter = ''; renderWorkspace(); await refresh();
  }
  async function handleError(error) {
    if (error?.status === 401 || (error?.status === 403 && !session.authenticated)) {
      const text = error.code === 'INVALID_CREDENTIALS' ? 'No se pudo iniciar sesión. Revisa tus datos de correo y contraseña.' : user ? 'Tu sesión venció. Inicia sesión para continuar.' : 'La sesión no es válida. Revisa tus datos e inicia sesión de nuevo.';
      await tracker.stop().catch(() => {}); renderLogin(text); return;
    }
    if (error?.code === 'NOTIFICATIONS_DENIED') {
      notificationDenied = true;
      message('Permite las notificaciones del teléfono para ver el aviso durante el reparto. Abre los permisos y vuelve a compartir ubicación.', true);
      if (elements.settings) elements.settings.hidden = false;
      return;
    }
    if (error?.status === 409 && user) {
      await refresh().catch(() => {});
      message('La entrega cambió. Revisa su estado actualizado antes de continuar.', true); return;
    }
    message(error?.status === 429 ? 'Hay demasiados intentos. Espera unos minutos antes de volver a intentarlo.' : error?.status === 403 ? 'Tu cuenta no tiene permiso para esta acción. Consulta con la farmacia.' : 'No se pudo completar la acción. Revisa la conexión y vuelve a intentarlo.', true);
  }
  async function perform(action) {
    if (busy || disposed) return;
    const focusedId = document.activeElement?.id;
    setBusy(true); message();
    try { await action(); } catch (error) { await handleError(error); }
    finally {
      setBusy(false);
      if (focusedId) document.getElementById(focusedId)?.focus();
      if (pendingRefresh) { pendingRefresh = false; queueMicrotask(recover); }
    }
  }
  function recover() {
    elements.network.hidden = navigator.onLine;
    if (!user || document.visibilityState === 'hidden' || disposed) return;
    if (busy) { pendingRefresh = true; return; }
    void perform(refresh);
  }
  async function click(event) {
    const control = event.target.closest('button[data-action]');
    if (!control || !root.contains(control) || control.disabled || control.dataset.action === 'login') return;
    const action = control.dataset.action, item = result.items.find(delivery => delivery.id === control.dataset.id);
    await perform(async () => {
      if (action === 'restore') return acceptUser(await session.restore());
      if (action === 'logout') {
        let failed = false, localCloseFailed = false;
        try { await tracker.stop(); } catch { failed = true; }
        try { await session.logout(); } catch (error) { failed = true; localCloseFailed = ['LOCAL_LOGOUT_FAILED','SECURE_STORAGE_ERROR'].includes(error.code); }
        renderLogin();
        if (failed) message(localCloseFailed ? 'No se pudo confirmar el cierre en este teléfono. Revisa la conexión y el almacenamiento seguro antes de cerrar la app y vuelve a intentarlo.' : 'La sesión se cerró en este teléfono. No se pudo confirmar todo el cierre remoto; revisa la conexión y los permisos del GPS.', true);
        document.getElementById('login-email')?.focus(); return;
      }
      if (action === 'settings') return runtime.openSettings();
      if (action === 'map' && item) return openRoute(item);
      if (action === 'close-map') return closeRoute();
      if (action === 'previous' || action === 'next') page += action === 'next' ? 1 : -1;
      if (action === 'state' && item) {
        if(control.dataset.state==='entregada' && !window.confirm('¿Confirmas que entregaste el pedido al destinatario? El seguimiento finalizará.'))return;
        if(control.dataset.state==='en_camino')await runtime.ensureNotifications();
        const saved=await session.request('/entregas/' + encodeURIComponent(item.id) + '/estado', {method: 'PUT', data: {estado: control.dataset.state, esperadoVersion: item.version}});
        if(control.dataset.state==='en_camino'){await openRoute(saved);await tracker.start(saved);}
        if (control.dataset.state === 'entregada' && tracker.state.activeId === item.id) await tracker.stop();
      }
      if (action === 'gps' && item) {
        if (tracker.state.activeId === item.id) await tracker.stop();
        else { await runtime.ensureNotifications(); notificationDenied = false; await tracker.start(item); }
      }
      if (user) await refresh();
    });
  }
  async function submit(event) {
    if (!event.target.matches('[data-login]')) return;
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const email = form.elements.email.value.trim(), password = form.elements.password.value;
    form.elements.password.value = '';
    await perform(async () => { await acceptUser(await session.login(email, password)); });
    if (user) elements.main.focus();
  }
  function change(event) {
    if (event.target.id !== 'delivery-filter') return;
    filter = event.target.value; page = 1; void perform(refresh);
  }

  renderLogin();
  root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change);
  window.addEventListener('focus', recover); window.addEventListener('online', recover); window.addEventListener('offline', recover);
  document.addEventListener('visibilitychange', recover);
  const ageTimer = window.setInterval(() => {updateTracking(tracking);recover();}, 15000);
  await perform(async () => { await acceptUser(await session.restore()); });
  return {updateTracking, dispose() {
    closeRoute();
    disposed = true; window.clearInterval(ageTimer);
    root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('change', change);
    window.removeEventListener('focus', recover); window.removeEventListener('online', recover); window.removeEventListener('offline', recover);
    document.removeEventListener('visibilitychange', recover);
  }};
}
