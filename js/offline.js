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
      notice.textContent = 'Estás sin conexión. Los datos del carrito se conservan en este navegador. Conéctate para continuar.';
      return;
    }
    notice.textContent = 'Conexión recuperada. Ya puedes enviar tu pedido por WhatsApp.';
    hideTimer = global.setTimeout(() => { notice.hidden = true; }, 6000);
  }

  global.addEventListener('offline', updateConnection);
  global.addEventListener('online', updateConnection);

})(globalThis);
