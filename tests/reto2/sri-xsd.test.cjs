'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.SRI_XSD_PYTHON||(fs.existsSync(bundled)?bundled:'python3');
const probe=spawnSync(python,['-c','import lxml.etree'],{timeout:5000,maxBuffer:4096,windowsHide:true});
test('factura2.1.0 firmada y descuentos pasan XSD oficial SRI con resolución de archivos local', {skip:probe.status!==0?'Validación XSD requiere Python con lxml (SRI_XSD_PYTHON).':false},()=>{
  const crypt=require('../../server/models/sri-crypto.cjs'),doc=require('../../server/models/sri-document.cjs'),fixture=require('./sri-fixture.cjs'),certificate=fixture.certificateFixture();
  try{
    const date=new Date(),xml=doc.buildXml(doc.snapshot(fixture.orderFixture(),fixture.buyer,fixture.emitter),doc.accessKey(fixture.emitter,1,date,'12345678'),1,date),signed=crypt.signXml(xml,crypt.readCertificate(certificate.archivoBase64,certificate.password));
    const script='from lxml import etree; import sys; p=etree.XMLParser(no_network=True,resolve_entities=False); s=etree.XMLSchema(etree.parse(sys.argv[1],p)); d=etree.fromstring(sys.stdin.buffer.read(),p); s.assertValid(d); print("XSD OK")';
    const result=spawnSync(python,['-c',script,path.join(__dirname,'fixtures/sri/factura_V2.1.0.xsd')],{input:signed,encoding:'utf8',timeout:8000,maxBuffer:32768,windowsHide:true});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'XSD OK');
  }finally{certificate.cleanup();}
});

test('envío general, cero y gratuito forman línea SERV-ENVIO válida en XSD oficial', {skip:probe.status!==0?'Validación XSD requiere Python con lxml (SRI_XSD_PYTHON).':false},()=>{
 const crypt=require('../../server/models/sri-crypto.cjs'),doc=require('../../server/models/sri-document.cjs'),fixture=require('./sri-fixture.cjs'),certificate=fixture.certificateFixture();
 try{
  for(const [fee,rate,base,tax] of [[230,15,2,.3],[200,0,2,0],[0,15,0,0]]){
   const order={...fixture.orderFixture(),costoEnvioCentavos:fee,envioIvaPorcentaje:rate,envioBaseImponible:base,envioIvaMonto:tax,total:11.5+fee/100,baseImponible:10+base,ivaMonto:1.5+tax};
   const snapshot=doc.snapshot(order,fixture.buyer,fixture.emitter);assert.equal(snapshot.lineas[1].codigo,'SERV-ENVIO');
   const date=new Date(),xml=doc.buildXml(snapshot,doc.accessKey(fixture.emitter,2,date,'12345678'),2,date),signed=crypt.signXml(xml,crypt.readCertificate(certificate.archivoBase64,certificate.password));
   const script='from lxml import etree; import sys; p=etree.XMLParser(no_network=True,resolve_entities=False); s=etree.XMLSchema(etree.parse(sys.argv[1],p)); s.assertValid(etree.fromstring(sys.stdin.buffer.read(),p)); print("XSD OK")';
   const result=spawnSync(python,['-c',script,path.join(__dirname,'fixtures/sri/factura_V2.1.0.xsd')],{input:signed,encoding:'utf8',timeout:8000,maxBuffer:32768,windowsHide:true});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'XSD OK');
  }
 }finally{certificate.cleanup();}
});
