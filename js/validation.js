(function (global) {
  'use strict';
  const patterns = {
    name: /^[\p{L}\p{M}]+(?:[ .’'-][\p{L}\p{M}]+)*\.?$/u,
    email: /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/,
    phone: /^\+?\d{7,15}$/,
    message: /^[\s\S]{10,1000}$/,
  };

  function validate(values) {
    const data = Object.fromEntries(['name', 'email', 'phone', 'message'].map((key) => [key, String(values[key] || '').trim()]));
    const errors = {};
    if (data.name.length < 2 || data.name.length > 80 || !patterns.name.test(data.name)) errors.name = 'Escribe tu nombre con letras (entre 2 y 80 caracteres).';
    if (data.email.length > 254 || data.email.includes('..') || !patterns.email.test(data.email)) errors.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    const phone = data.phone.replace(/[\s()-]/g, '');
    if (!patterns.phone.test(phone)) errors.phone = 'Escribe un teléfono de 7 a 15 dígitos; puedes incluir + y el código de país.';
    if (!patterns.message.test(data.message)) errors.message = 'Escribe una consulta de 10 a 1000 caracteres.';
    return errors;
  }

  const api = { patterns, validate };
  (global.Farmacia ||= {}).validation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
