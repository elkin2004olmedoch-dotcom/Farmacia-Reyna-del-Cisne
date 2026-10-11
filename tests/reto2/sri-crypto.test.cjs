'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const crypt=require('../../server/models/sri-crypto.cjs'),doc=require('../../server/models/sri-document.cjs'),transport=require('../../server/models/sri-transport.cjs');
const fixture=require('./sri-fixture.cjs'),certificate=fixture.certificateFixture();
after(()=>certificate.cleanup());
const date=new Date('2026-10-11T00:30:00Z');
test('clave SRI49dígitos, módulo11 y fecha de Ecuador coinciden con ejemplo oficial',()=>{
  assert.equal(doc.mod11('050320120117600132100011001003000990064123456781'),4);
  assert.equal(doc.accessKey({...fixture.emitter,ruc:'1760013210001',puntoEmision:'003'},990064,new Date('2012-03-05T15:00:00Z'),'12345678'),'0503201201176001321000110010030009900641234567814');
  assert.equal(doc.ecuadorDate(date).xml,'10/10/2026');assert.throws(()=>doc.accessKey(fixture.emitter,1000000000,date),{code:'INVALID_SEQUENCE'});
});
test('PKCS12 válido, contraseña incorrecta, archivo inválido y caducidad se verifican sin forge',()=>{
  const material=crypt.readCertificate(certificate.archivoBase64,certificate.password);assert.equal(material.ruc,fixture.emitter.ruc);assert.equal(material.certificate.publicKey.asymmetricKeyType,'rsa');
  assert.throws(()=>crypt.readCertificate(certificate.archivoBase64,'wrong-password'),{code:'INVALID_CERTIFICATE'});assert.throws(()=>crypt.readCertificate('invalid!',certificate.password),{code:'INVALID_CERTIFICATE'});
  assert.throws(()=>crypt.readCertificate(certificate.archivoBase64,certificate.password,new Date('2040-01-01')),{code:'CERTIFICATE_EXPIRED'});
});
test('base64 de2MiB inválido devuelve400 y2MiB+1 se rechaza antes de OpenSSL sin desbordar regex',()=>{
  const large=Buffer.alloc(2*1024*1024).toString('base64');
  assert.throws(()=>crypt.readCertificate(large,'synthetic-only'),error=>error.status===400&&error.code==='INVALID_CERTIFICATE');
  const previous=process.env.OPENSSL_PATH;process.env.OPENSSL_PATH='farmacia-sri-test-missing-openssl-executable';
  try{
    const oversized=Buffer.alloc(2*1024*1024+1).toString('base64');
    assert.throws(()=>crypt.readCertificate(oversized,'synthetic-only'),error=>error.status===400&&error.code==='INVALID_CERTIFICATE');
    assert.throws(()=>crypt.readCertificate('AB==','synthetic-only'),error=>error.status===400&&error.code==='INVALID_CERTIFICATE');
    assert.throws(()=>crypt.readCertificate('A===','synthetic-only'),error=>error.status===400&&error.code==='INVALID_CERTIFICATE');
  }finally{if(previous===undefined)delete process.env.OPENSSL_PATH;else process.env.OPENSSL_PATH=previous;}
});
test('almacenamiento AEAD separa claves, IV y salt, detecta alteración y no contiene secretos legibles',()=>{
  const secret=crypto.randomBytes(48).toString('hex'),value={archivoBase64:certificate.archivoBase64,password:certificate.password};const a=crypt.encrypt(value,secret),b=crypt.encrypt(value,secret);
  assert.notEqual(a,b);assert.ok(!a.includes(certificate.password));assert.ok(!a.includes(certificate.archivoBase64));assert.deepEqual(crypt.decrypt(a,secret),value);assert.throws(()=>crypt.decrypt(a,crypto.randomBytes(48).toString('hex')),{code:'CERTIFICATE_UNAVAILABLE'});
  const chunks=a.split('.');chunks[4]=Buffer.from('tampered').toString('base64');assert.throws(()=>crypt.decrypt(chunks.join('.'),secret),{code:'CERTIFICATE_UNAVAILABLE'});
});
test('XML conserva descuento, tarifa0/13/14/15 y snapshots, escapando caracteres',()=>{
  const data=doc.snapshot(fixture.orderFixture(),fixture.buyer,fixture.emitter),xml=doc.buildXml(data,doc.accessKey(fixture.emitter,1,date,'12345678'),1,date);const parsed=crypt.parseXml(xml);
  assert.equal(parsed.documentElement.getAttribute('version'),'2.1.0');assert.equal(parsed.getElementsByTagName('totalDescuento')[0].textContent,'10.00');assert.equal(parsed.getElementsByTagName('codigoPorcentaje')[0].textContent,'4');assert.equal(parsed.getElementsByTagName('descripcion')[0].textContent,'Producto <prueba> & bienestar');
  const legacy=fixture.orderFixture();legacy.detalles[0].ivaPorcentaje=null;assert.throws(()=>doc.snapshot(legacy,fixture.buyer,fixture.emitter),{code:'NEED_TAX_SNAPSHOT'});
  const cancelled=fixture.orderFixture();cancelled.estado='cancelado';assert.throws(()=>doc.snapshot(cancelled,fixture.buyer,fixture.emitter),{code:'ORDER_CANCELLED'});
  for(const rate of [0,13,14,15]){const order=fixture.orderFixture(),total=1000+rate*10;Object.assign(order,{total:(total/100).toFixed(2),ivaMonto:(rate/10).toFixed(2)});Object.assign(order.detalles[0],{ivaPorcentaje:rate,ivaMonto:order.ivaMonto,totalLinea:order.total});const xml=doc.buildXml(doc.snapshot(order,fixture.buyer,fixture.emitter));assert.equal(crypt.parseXml(xml).getElementsByTagName('codigoPorcentaje')[0].textContent,{0:'0',13:'10',14:'3',15:'4'}[rate]);}
});
test('firma XAdES-BES vincula factura, SignedProperties y KeyInfo; alteración invalida firma',()=>{
  const material=crypt.readCertificate(certificate.archivoBase64,certificate.password),data=doc.snapshot(fixture.orderFixture(),fixture.buyer,fixture.emitter),xml=doc.buildXml(data,doc.accessKey(fixture.emitter,1,date,'12345678'),1,date),signed=crypt.signXml(xml,material);
  assert.ok(crypt.verifyXml(signed,material.certificatePem));const parsed=crypt.parseXml(signed);assert.equal(parsed.getElementsByTagNameNS(crypt.XADES,'SignedProperties').length,1);assert.equal(parsed.getElementsByTagNameNS(crypt.DS,'Reference').length,3);
  assert.equal(crypt.verifyXml(signed.replace('<importeTotal>11.50</importeTotal>','<importeTotal>99.99</importeTotal>'),material.certificatePem),false);
  assert.equal(crypt.verifyXml(signed.replace('Factura electrónica','Documento alterado'),material.certificatePem),false);
});
test('SOAP sólo autoriza respuesta AUTORIZADO de la misma clave, rechaza DTD/XXE y errores',()=>{
  const key=doc.accessKey(fixture.emitter,1,date,'12345678'),xml=doc.buildXml(doc.snapshot(fixture.orderFixture(),fixture.buyer,fixture.emitter),key,1,date);
  assert.equal(transport.parseReception(fixture.reception(key),key).estado,'RECIBIDA');assert.equal(transport.parseReception(fixture.reception(key,'DEVUELTA'),key).estado,'DEVUELTA');
  assert.equal(transport.parseAuthorization(fixture.authorization(key,xml),key).estado,'AUTORIZADA');assert.equal(transport.parseAuthorization(fixture.authorization(key,xml,'NO AUTORIZADO'),key).estado,'NO_AUTORIZADA');assert.equal(transport.parseAuthorization(fixture.authorization(key,xml,'PENDIENTE'),key).estado,'EN_PROCESO');
  assert.throws(()=>transport.parseAuthorization(fixture.authorization(key,xml),key.replace(/^./,'9')),{code:'SRI_KEY_MISMATCH'});assert.throws(()=>crypt.parseXml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///private">]><a>&x;</a>'),{code:'SRI_INVALID_XML'});assert.throws(()=>crypt.parseXml('<factura>'),{code:'SRI_INVALID_XML'});
});
test('transporte usa endpoints oficiales y SOAP base64 sin secretos',async()=>{
  const key=doc.accessKey(fixture.emitter,1,date,'12345678'),calls=[],t=transport.createTransport(async(url,body)=>{calls.push({url,body});return fixture.reception(key);});await t.receive('1','<factura>prueba</factura>',key);
  assert.equal(calls[0].url,transport.endpoints['1'].recepcion);assert.ok(calls[0].body.includes(Buffer.from('<factura>prueba</factura>').toString('base64')));await assert.rejects(t.receive('3','x',key),{code:'INVALID_ENVIRONMENT'});
});
test('configuración valida emisor, producción explícita y RUC del proveedor del software',()=>{
  assert.equal(doc.validateConfig(fixture.emitter).ambiente,'1');assert.throws(()=>doc.validateConfig({...fixture.emitter,ambiente:'2'}),{code:'VALIDATION_FAILED'});assert.equal(doc.validateConfig({...fixture.emitter,ambiente:'2',confirmarProduccion:true}).ambiente,'2');assert.throws(()=>doc.validateConfig({...fixture.emitter,softwarePropio:false}),{code:'VALIDATION_FAILED'});
  const cfg=doc.validateConfig({...fixture.emitter,softwarePropio:false,rucProveedorSoftware:'1790016919001'});assert.ok(doc.buildXml(doc.snapshot(fixture.orderFixture(),fixture.buyer,cfg)).includes('nombre="RUC Proveedor"'));
  assert.equal(doc.validateConfig({...fixture.emitter,nombreComercial:''}).nombreComercial,fixture.emitter.razonSocial);assert.throws(()=>doc.validateConfig({...fixture.emitter,ruc:1790016919001}),{code:'VALIDATION_FAILED'});
  assert.equal(doc.validateBuyer(fixture.buyer).formaPago,'01');assert.throws(()=>doc.validateBuyer({...fixture.buyer,formaPago:undefined}),{code:'VALIDATION_FAILED'});assert.throws(()=>doc.validateBuyer({...fixture.buyer,identificacionComprador:102030400}),{code:'VALIDATION_FAILED'});
});
