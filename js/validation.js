(function (global) {
  'use strict';
  const patterns = {
    name: /^[\p{L}\p{M}]+(?:[ .’'-][\p{L}\p{M}]+)*\.?$/u,
    email: /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/,
    phone: /^\+?\d{7,15}$/,
    message: /^[\s\S]{10,1000}$/,
  };

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function validate(values) {
    const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
    const data = Object.fromEntries(['name', 'email', 'phone', 'message'].map((key) => [key, text(source[key])]));
    const errors = {};
    if (data.name.length < 2 || data.name.length > 80 || !patterns.name.test(data.name)) errors.name = 'Escribe tu nombre con letras (entre 2 y 80 caracteres).';
    if (data.email.length > 254 || data.email.includes('..') || !patterns.email.test(data.email)) errors.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    const phone = data.phone.replace(/[\s()-]/g, '');
    if (!patterns.phone.test(phone)) errors.phone = 'Escribe un teléfono de 7 a 15 dígitos; puedes incluir + y el código de país.';
    if (!patterns.message.test(data.message)) errors.message = 'Escribe una consulta de 10 a 1000 caracteres.';
    return errors;
  }

  function validateBuyer(values) {
    const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
    const name = text(source.name);
    const phone = text(source.phone).replace(/[\s()-]/g, '');
    const address = text(source.address);
    const errors = {};
    if (name.length < 2 || name.length > 80 || !patterns.name.test(name)) errors.name = 'Escribe un nombre válido (2 a 80 letras).';
    if (!patterns.phone.test(phone)) errors.phone = 'Escribe un teléfono con 7 a 15 números.';
    if (address.length < 5 || address.length > 200 || !/[\p{L}\p{N}]/u.test(address) || /[\u0000-\u001f\u007f]/.test(address)) {
      errors.address = 'Escribe una dirección válida de 5 a 200 caracteres.';
    }
    return errors;
  }

  const api = { patterns, validate, validateBuyer };
  (global.Farmacia ||= {}).validation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
