(function (global) {
  'use strict';
  function initialize() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const fields = ['name', 'email', 'phone', 'message'];
    const status = document.getElementById('form-status');
    const success = document.getElementById('form-success');
    function showError(key, message) {
      const input = form.elements.namedItem(key);
      const error = document.getElementById(`contact-${key}-error`);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      error.textContent = message || '';
      error.hidden = !message;
    }
    form.addEventListener('input', (event) => {
      success.hidden = true;
      if (fields.includes(event.target.name)) showError(event.target.name, '');
      status.textContent = '';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(fields.map((key) => [key, form.elements.namedItem(key).value.trim()]));
      const errors = global.Farmacia.validation.validate(values);
      fields.forEach((key) => showError(key, errors[key]));
      const keys = Object.keys(errors);
      if (keys.length) {
        success.hidden = true;
        status.textContent = `Revisa ${keys.length} ${keys.length === 1 ? 'campo señalado' : 'campos señalados'}.`;
        form.elements.namedItem(keys[0]).focus();
        return;
      }
      status.textContent = '';
      const message = `Hola, soy ${values.name}.\nCorreo: ${values.email}\nTeléfono: ${values.phone}\nConsulta: ${values.message}`;
      document.getElementById('contact-whatsapp').href = `https://wa.me/593979275988?text=${encodeURIComponent(message)}`;
      success.hidden = false;
      document.getElementById('contact-whatsapp').focus();
    });
  }
  (global.Farmacia ||= {}).form = { initialize };
})(globalThis);
