(function (global) {
  'use strict';

  const notice = document.createElement('p');
  notice.className = 'offline-status';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;
  document.body.append(notice);

  let hideTimer;
  function updateConnection() {
    global.clearTimeout(hideTimer);
    notice.hidden = false;
    if (!global.navigator.onLine) {
      notice.textContent = 'Estás sin conexión. El catálogo, tu carrito y tus datos guardados siguen disponibles; para enviar el pedido por WhatsApp necesitas internet.';
      return;
    }
    notice.textContent = 'Conexión recuperada. Ya puedes enviar tu pedido por WhatsApp.';
    hideTimer = global.setTimeout(() => { notice.hidden = true; }, 6000);
  }

  global.addEventListener('offline', updateConnection);
  global.addEventListener('online', updateConnection);

  const scriptUrl = document.currentScript?.src;
  const securePage = global.location.protocol === 'https:'
    || ['localhost', '127.0.0.1'].includes(global.location.hostname);
  if ('serviceWorker' in global.navigator && securePage && scriptUrl) {
    const workerUrl = new URL('../service-worker.js', scriptUrl);
    const scope = new URL('../', scriptUrl).pathname;
    global.navigator.serviceWorker.register(workerUrl.href, { scope }).catch(() => {
      // El sitio se puede seguir usando en línea aunque el navegador rechace la caché offline.
    });
  }
})(globalThis);
