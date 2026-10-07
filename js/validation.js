(function (global) {
  'use strict';
  const patterns = {
    name: /^[\p{L}\p{M}]+(?:[ .’'-][\p{L}\p{M}]+)*\.?$/u,
    email: /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/,
    phone: /^(?:09\d{8}|0[2-7]\d{7}|\+5939\d{8}|\+593[2-7]\d{7})$/,
    message: /^[\s\S]{10,1000}$/,
  };

  function validate(values) {
    const data = Object.fromEntries(['name', 'email', 'phone', 'message'].map((key) => [key, String(values[key] || '').trim()]));
    const errors = {};
    if (data.name.length < 2 || data.name.length > 80 || !patterns.name.test(data.name)) errors.name = 'Escribe tu nombre con letras (entre 2 y 80 caracteres).';
    if (!validEmail(data.email)) errors.email = 'Escribe un correo válido, por ejemplo nombre@gmail.com. También aceptamos otros dominios.';
    if (!normalizePhone(data.phone)) errors.phone = 'Usa un teléfono de Ecuador: 09XXXXXXXX, un fijo con código 02 a 07, o +593 sin el 0 inicial.';
    if (!patterns.message.test(data.message)) errors.message = 'Escribe una consulta de 10 a 1000 caracteres.';
    return errors;
  }

  const clean = value => String(value ?? '').trim();
  const validName = value => clean(value).length >= 2 && clean(value).length <= 80 && patterns.name.test(clean(value));
  function validEmail(value) {
    const email = clean(value);
    const local = email.split('@')[0];
    return email.length <= 254 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.')
      && !email.includes('..') && patterns.email.test(email);
  }
  function normalizePhone(value) {
    const phone = clean(value).replace(/[\s()-]/g, '');
    if (!patterns.phone.test(phone)) return null;
    const normalized = phone.startsWith('+593') ? phone : '+593' + phone.slice(1);
    return /^(.)\1+$/.test(normalized.slice(5)) ? null : normalized;
  }
  function validCedula(value) {
    const id = clean(value);
    if (!/^\d{10}$/.test(id)) return false;
    const province = Number(id.slice(0, 2));
    if (!((province >= 1 && province <= 24) || province === 30) || Number(id[2]) > 5 || /^0+$/.test(id.slice(2, 9))) return false;
    const sum = [...id.slice(0, 9)].reduce((total, digit, i) => {
      const n = Number(digit) * (i % 2 ? 1 : 2);
      return total + (n > 9 ? n - 9 : n);
    }, 0);
    return (10 - sum % 10) % 10 === Number(id[9]);
  }
  function validRuc(value) {
    const id = clean(value);
    if (!/^\d{10}001$/.test(id)) return false;
    const province = Number(id.slice(0, 2));
    if (!((province >= 1 && province <= 24) || province === 30)) return false;
    const type = Number(id[2]);
    if (type < 6) return validCedula(id.slice(0, 10));
    const weights = type === 6 ? [3, 2, 7, 6, 5, 4, 3, 2] : type === 9 ? [4, 3, 2, 7, 6, 5, 4, 3, 2] : null;
    if (!weights || (type === 6 && id[9] !== '0')) return false;
    const remainder = weights.reduce((sum, weight, i) => sum + Number(id[i]) * weight, 0) % 11;
    const check = remainder === 0 ? 0 : 11 - remainder;
    return check < 10 && check === Number(id[weights.length]);
  }
  const provinces = ['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'];
  const provinceCodes = { Azuay:'01', Bolívar:'02', Cañar:'03', Carchi:'04', Cotopaxi:'05', Chimborazo:'06', 'El Oro':'07', Esmeraldas:'08', Guayas:'09', Imbabura:'10', Loja:'11', 'Los Ríos':'12', Manabí:'13', 'Morona Santiago':'14', Napo:'15', Pastaza:'16', Pichincha:'17', Tungurahua:'18', 'Zamora Chinchipe':'19', Galápagos:'20', Sucumbíos:'21', Orellana:'22', 'Santo Domingo de los Tsáchilas':'23', 'Santa Elena':'24' };
  function validateBuyer(values) {
    values = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
    const errors = {};
    if (!validName(values.name)) errors.name = 'Escribe el nombre del comprador con letras (2 a 80 caracteres).';
    if (!normalizePhone(values.phone)) errors.phone = 'Escribe un teléfono ecuatoriano válido: 09XXXXXXXX o +5939XXXXXXXX.';
    const address = clean(values.address);
    if (address.length < 8 || address.length > 200 || !/\p{L}/u.test(address) || /[<>\x00-\x1f]/.test(address)) errors.address = 'Escribe calle, numeración o s/n y referencia (8 a 200 caracteres).';
    return errors;
  }
  function validateRegistration(values) {
    const errors = {};
    for (const key of ['name', 'surname']) if (!validName(values[key])) errors[key] = 'Usa letras, tildes y espacios (2 a 80 caracteres).';
    if (!validEmail(values.email)) errors.email = 'Escribe un correo electrónico válido.';
    if (!normalizePhone(values.phone)) errors.phone = 'Usa un teléfono de Ecuador: 09XXXXXXXX o +5939XXXXXXXX; también se aceptan fijos con código de área.';
    if (!validCedula(values.cedula)) errors.cedula = 'La cédula debe tener 10 dígitos, provincia válida y dígito verificador correcto.';
    if (!/^(?=.{8,128}$)(?=.*\p{L})(?=.*\d)\S+$/u.test(String(values.password ?? ''))) errors.password = 'Usa de 8 a 128 caracteres, al menos una letra y un número, sin espacios.';
    if (!values.confirm || values.password !== values.confirm) errors.confirm = 'Las contraseñas deben coincidir.';
    if (!values.terms) errors.terms = 'Acepta las condiciones y la privacidad para crear tu cuenta local.';
    return errors;
  }
  function validateCheckout(values) {
    const errors = validateBuyer({ ...values, address: values.delivery === 'pickup' ? 'Retiro en farmacia' : values.address });
    if (!validEmail(values.email)) errors.email = 'Escribe un correo electrónico válido.';
    if (!['cedula', 'ruc'].includes(values.documentType)) errors.documentType = 'Selecciona cédula o RUC.';
    else if (!(values.documentType === 'ruc' ? validRuc(values.document) : validCedula(values.document))) errors.document = values.documentType === 'ruc' ? 'RUC inválido: revisa los 13 dígitos y su verificador.' : 'Cédula inválida: revisa los 10 dígitos y su verificador.';
    if (!['pickup', 'delivery'].includes(values.delivery)) errors.delivery = 'Selecciona retiro o entrega por coordinar.';
    if (values.delivery === 'delivery') {
      if (!provinces.includes(values.province)) errors.province = 'Selecciona una de las 24 provincias de Ecuador.';
      if (!validName(values.city)) errors.city = 'Escribe el cantón o ciudad con letras (2 a 80 caracteres).';
      if (clean(values.postalCode) && !/^\d{6}$/.test(clean(values.postalCode))) errors.postalCode = 'El código postal de Ecuador tiene 6 dígitos.';
      else if (clean(values.postalCode) && provinceCodes[values.province] && !clean(values.postalCode).startsWith(provinceCodes[values.province])) errors.postalCode = 'Los dos primeros dígitos del código postal deben corresponder a la provincia seleccionada.';
    }
    return errors;
  }
  function cardBrand(value) {
    const number = clean(value).replace(/[ -]/g, '');
    if (/^4\d{15}$/.test(number)) return 'Visa';
    if (/^\d{16}$/.test(number) && (/^5[1-5]/.test(number) || Number(number.slice(0, 4)) >= 2221 && Number(number.slice(0, 4)) <= 2720)) return 'Mastercard';
    return null;
  }
  function luhn(value) {
    const number = clean(value).replace(/[ -]/g, '');
    if (!/^\d{13,19}$/.test(number) || /^(\d)\1+$/.test(number)) return false;
    const sum = [...number].reverse().reduce((total, digit, i) => {
      const n = Number(digit) * (i % 2 ? 2 : 1);
      return total + (n > 9 ? n - 9 : n);
    }, 0);
    return sum % 10 === 0;
  }
  function validateCard(values, now = new Date()) {
    const errors = {};
    if (!validName(values.holder)) errors.holder = 'Escribe el nombre del titular como aparece en la tarjeta.';
    if (!cardBrand(values.cardNumber) || !luhn(values.cardNumber)) errors.cardNumber = 'Usa una Visa o Mastercard de 16 dígitos con verificador Luhn correcto.';
    const match = clean(values.expiry).match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/);
    const year = match ? Number(match[2]) + (match[2].length === 2 ? 2000 : 0) : 0;
    const month = match ? Number(match[1]) : 0;
    if (!match || year < now.getFullYear() || year === now.getFullYear() && month < now.getMonth() + 1 || year > now.getFullYear() + 20) errors.expiry = 'Usa MM/AA con un mes válido y una fecha vigente.';
    if (!/^\d{3}$/.test(clean(values.cvv))) errors.cvv = 'El CVV de Visa o Mastercard tiene 3 números.';
    return errors;
  }
  const api = { patterns, provinces, validName, validEmail, normalizePhone, validCedula, validRuc, validate, validateBuyer, validateRegistration, validateCheckout, cardBrand, luhn, validateCard };
  (global.Farmacia ||= {}).validation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
