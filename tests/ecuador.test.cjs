const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../js/validation.js');
test('teléfonos nacionales e internacionales se normalizan a Ecuador', () => {
  for (const input of ['0979275988','+593 97 927 5988','(09) 7927-5988']) assert.equal(v.normalizePhone(input), '+593979275988');
  assert.equal(v.normalizePhone('02 294-6400'), '+59322946400');
  assert.equal(v.normalizePhone('+593 7 282 0860'), '+59372820860');
  for (const input of ['1234567','097927598','09792759888','+5930979275988','+51979275988','0999999999','020000000','a0979275988','593979275988','08 2946400']) assert.equal(v.normalizePhone(input),null,input);
});
test('cédula comprueba provincia, tipo, longitud y módulo 10 conservando ceros', () => {
  assert.equal(v.validCedula('0102030400'),true);
  for (const id of ['0102030401','0002030400','2502030400','0192030400','010203040','01020304000','abcdefghij','0000000000','0100000008']) assert.equal(v.validCedula(id),false,id);
});
test('RUC admite persona natural, sociedad privada y entidad pública con sus verificadores', () => {
  for (const id of ['0102030400001','1790016919001','1760001550001']) assert.equal(v.validRuc(id),true,id);
  for (const id of ['0102030401001','1790016918001','1760001560001','1790016919000','1790016919002','1760001551001','1770016919001','9999999999999','1790016919']) assert.equal(v.validRuc(id),false,id);
});
test('correo acepta dominios internacionales y ec y rechaza estructura inválida', () => {
  for (const email of ['nombre@gmail.com','maria+pedido@empresa.com.ec','nombre@outlook.es']) assert.equal(v.validEmail(email),true,email);
  for (const email of ['.maria@gmail.com','maria.@gmail.com','maria..p@gmail.com','maria@gmail','maria@@gmail.com','maria@-empresa.ec','maria @gmail.com']) assert.equal(v.validEmail(email),false,email);
});
test('registro valida cédula y confirmación literal de contraseña', () => {
  const fixture = {name:'María José',surname:'Pérez',email:'maria@example.ec',phone:'0979275988',cedula:'0102030400',password:'Prueba123',confirm:'Prueba123',terms:true};
  assert.deepEqual(v.validateRegistration(fixture),{});
  assert.ok(v.validateRegistration({...fixture,cedula:'0102030401'}).cedula);
  assert.ok(v.validateRegistration({...fixture,confirm:'Prueba123 '}).confirm);
  assert.ok(v.validateRegistration({...fixture,password:'password',confirm:'password'}).password);
  assert.ok(v.validateRegistration({...fixture,terms:false}).terms);
});
test('entrega exige provincia y dirección; retiro no exige domicilio', () => {
  const fixture={name:'María Pérez',email:'maria@example.com',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup'};
  assert.deepEqual(v.validateCheckout(fixture),{});
  assert.deepEqual(v.validateCheckout({...fixture,delivery:'delivery',province:'Pichincha',city:'Quito',address:'Av. Amazonas N10-20, cerca del parque',postalCode:'170101'}),{});
  const issues=v.validateCheckout({...fixture,delivery:'delivery',province:'Lima',city:'123',address:'x',postalCode:'12345'});
  for(const key of ['province','city','address','postalCode']) assert.ok(issues[key],key);
  assert.equal(v.provinces.length,24);
  assert.ok(v.validateCheckout({...fixture,delivery:'delivery',province:'Pichincha',city:'Quito',address:'Av. Amazonas N10-20',postalCode:'090101'}).postalCode);
});
test('tarjeta de Ecuador, Visa y Mastercard pasan Luhn; fecha actual sigue vigente', () => {
  const now=new Date(2026,9,7);
  const fixture={holder:'Cliente de Prueba',cardNumber:'4000 0021 8000 0000',expiry:'10/26',cvv:'123'};
  assert.deepEqual(v.validateCard(fixture,now),{});
  for(const number of ['5555555555554444','2223003122003222']) assert.deepEqual(v.validateCard({...fixture,cardNumber:number},now),{});
  for(const number of ['4000002180000001','0000000000000000','1234','378282246310005','4000002180000000x']) assert.ok(v.validateCard({...fixture,cardNumber:number},now).cardNumber,number);
  for(const expiry of ['09/26','00/27','13/27','10/25','10/70','1/27','texto']) assert.ok(v.validateCard({...fixture,expiry},now).expiry,expiry);
  for(const cvv of ['12','1234','abc','']) assert.ok(v.validateCard({...fixture,cvv},now).cvv,cvv);
});
