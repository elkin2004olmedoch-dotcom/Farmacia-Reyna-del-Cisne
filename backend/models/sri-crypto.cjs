'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {SignedXml}=require('xml-crypto');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const {AppError}=require('../middleware/errors.cjs');
const DS='http://www.w3.org/2000/09/xmldsig#',XADES='http://uri.etsi.org/01903/v1.3.2#';
const C14N='http://www.w3.org/TR/2001/REC-xml-c14n-20010315',SHA1=DS+'sha1';
const MAX_P12_BYTES=2*1024*1024;
// No repeated capture groups: multi-megabyte uploads must not exhaust the regex stack.
const canonicalBase64=value=>typeof value==='string'&&value.length>0&&value.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(value);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
function parseXml(xml) {
  if(typeof xml!=='string'||Buffer.byteLength(xml)>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(xml))throw new AppError(502,'SRI_INVALID_XML','El XML no es seguro o supera el límite permitido.');
  try{return new DOMParser({onError:()=>{throw new Error('Invalid XML');}}).parseFromString(xml,'application/xml');}
  catch(_){throw new AppError(502,'SRI_INVALID_XML','El SRI devolvió XML no válido.');}
}
function encrypt(value,secret) {
  const iv=crypto.randomBytes(12),salt=crypto.randomBytes(32);
  const key=Buffer.from(crypto.hkdfSync('sha256',Buffer.from(secret),salt,Buffer.from('farmacia/sri/certificado/v1'),32));
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('farmacia-sri-v1'));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);key.fill(0);
  return ['v1',salt.toString('base64'),iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
}
function decrypt(value,secret) {
  try{const [version,salt,iv,tag,body]=value.split('.');if(version!=='v1')throw new Error();
    const key=Buffer.from(crypto.hkdfSync('sha256',Buffer.from(secret),Buffer.from(salt,'base64'),Buffer.from('farmacia/sri/certificado/v1'),32));
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from('farmacia-sri-v1'));decipher.setAuthTag(Buffer.from(tag,'base64'));
    const plain=Buffer.concat([decipher.update(Buffer.from(body,'base64')),decipher.final()]);key.fill(0);const result=JSON.parse(plain.toString('utf8'));plain.fill(0);return result;
  }catch(_){throw new AppError(409,'CERTIFICATE_UNAVAILABLE','No se puede abrir la firma guardada. Vuelve a cargarla desde administración.');}
}
function readCertificate(base64,password,now=new Date()) {
  if(typeof base64!=='string'||base64.length>Math.ceil(MAX_P12_BYTES/3)*4||!canonicalBase64(base64)||typeof password!=='string'||password.length<1||password.length>256)throw new AppError(400,'INVALID_CERTIFICATE','Carga un archivo .p12 de hasta 2 MiB y su contraseña.');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length>MAX_P12_BYTES||bytes.toString('base64')!==base64)throw new AppError(400,'INVALID_CERTIFICATE','Carga un archivo .p12 de hasta 2 MiB y su contraseña.');
  try{
    // The password is passed only in the child environment, never argv or files.
    // OpenSSL extracts PKCS12; Node's native crypto validates and signs RSA.
    const result=extractPkcs12(bytes,password);
    const keys=result.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/g)||[];
    if(keys.length!==1)throw new Error();
    const privatePem=keys[0],privateKey=crypto.createPrivateKey(privatePem);
    if(privateKey.asymmetricKeyType!=='rsa'||privateKey.asymmetricKeyDetails.modulusLength<2048)throw new Error();
    const publicDer=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'});
    const certificates=result.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)||[];if(certificates.length>20)throw new Error();
    const matching=certificates.filter(pem=>new crypto.X509Certificate(pem).publicKey.export({type:'spki',format:'der'}).equals(publicDer));
    if(matching.length!==1)throw new Error();
    const certificate=new crypto.X509Certificate(matching[0]);
    if(new Date(certificate.validFrom)>now||new Date(certificate.validTo)<=now)throw new AppError(400,'CERTIFICATE_EXPIRED','La firma electrónica está vencida o todavía no está vigente.');
    const issuer=certificates.map(pem=>new crypto.X509Certificate(pem)).find(candidate=>certificate.checkIssued(candidate));
    if(issuer&&!certificate.verify(issuer.publicKey))throw new Error('Invalid certificate signature');
    const certRuc=certificate.subject.split('\n').map(a=>a.slice(a.indexOf('=')+1)).find(v=>/^\d{10}001$/.test(v))||null;
    return {privatePem,certificatePem:matching[0],certificate,venceEn:new Date(certificate.validTo),ruc:certRuc};
  }catch(error){if(error instanceof AppError)throw error;throw new AppError(400,'INVALID_CERTIFICATE','No se pudo abrir la firma. Revisa el archivo .p12, su contraseña y que use RSA de al menos 2048 bits.');}
}
function opensslPath(){return process.env.OPENSSL_PATH||(fs.existsSync('C:/Program Files/Git/usr/bin/openssl.exe')?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl');}
let cachedCapability;
function opensslAvailable(){if(cachedCapability===undefined){const result=spawnSync(opensslPath(),['version'],{encoding:'utf8',timeout:2000,maxBuffer:4096,windowsHide:true});cachedCapability=result.status===0&&!result.error;}return cachedCapability;}
function extractPkcs12(input,password){
  const options={input,encoding:'utf8',timeout:8000,maxBuffer:4*1024*1024,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,FARMACIA_P12_PASSWORD:password}};
  let result=spawnSync(opensslPath(),['pkcs12','-nodes','-passin','env:FARMACIA_P12_PASSWORD'],options);
  if(result.error?.code==='ENOENT')throw new AppError(503,'OPENSSL_UNAVAILABLE','El servidor necesita OpenSSL para importar la firma electrónica.');
  if(result.status!==0&&!result.error)result=spawnSync(opensslPath(),['pkcs12','-legacy','-nodes','-passin','env:FARMACIA_P12_PASSWORD'],options);
  if(result.status!==0||result.error)throw new Error('PKCS12 import failed');return result.stdout;
}
function signXml(xml,material,now=new Date()) {
  const doc=parseXml(xml);if(doc.documentElement.nodeName!=='factura'||doc.documentElement.getAttribute('id')!=='comprobante')throw new AppError(400,'INVALID_INVOICE_XML','La factura no tiene la estructura esperada.');
  const suffix=crypto.randomBytes(10).toString('hex'),signatureId='Signature-'+suffix,propertiesId='SignedProperties-'+suffix,keyId='Certificate-'+suffix,referenceId='Reference-'+suffix;
  const certificate64=material.certificate.raw.toString('base64');
  const issuer=material.certificate.issuer.split('\n').reverse().join(',');
  const serial=BigInt('0x'+material.certificate.serialNumber).toString();
  const properties=`<etsi:QualifyingProperties xmlns:etsi="${XADES}" Target="#${signatureId}"><etsi:SignedProperties Id="${propertiesId}"><etsi:SignedSignatureProperties><etsi:SigningTime>${now.toISOString()}</etsi:SigningTime><etsi:SigningCertificate><etsi:Cert><etsi:CertDigest><ds:DigestMethod Algorithm="${SHA1}"/><ds:DigestValue>${crypto.createHash('sha1').update(material.certificate.raw).digest('base64')}</ds:DigestValue></etsi:CertDigest><etsi:IssuerSerial><ds:X509IssuerName>${escape(issuer)}</ds:X509IssuerName><ds:X509SerialNumber>${serial}</ds:X509SerialNumber></etsi:IssuerSerial></etsi:Cert></etsi:SigningCertificate></etsi:SignedSignatureProperties><etsi:SignedDataObjectProperties><etsi:DataObjectFormat ObjectReference="#${referenceId}"><etsi:Description>Factura electrónica</etsi:Description><etsi:MimeType>text/xml</etsi:MimeType></etsi:DataObjectFormat></etsi:SignedDataObjectProperties></etsi:SignedProperties></etsi:QualifyingProperties>`;
  const signer=new SignedXml({privateKey:material.privatePem,publicCert:material.certificatePem,signatureAlgorithm:DS+'rsa-sha1',canonicalizationAlgorithm:C14N,keyInfoAttributes:{Id:keyId},getKeyInfoContent:()=>`<ds:X509Data><ds:X509Certificate>${certificate64}</ds:X509Certificate></ds:X509Data>`,objects:[{content:properties}]});
  signer.addReference({xpath:`//*[@Id='${propertiesId}']`,digestAlgorithm:SHA1,transforms:[C14N],type:'http://uri.etsi.org/01903#SignedProperties'});
  signer.addReference({xpath:`//*[@Id='${keyId}']`,digestAlgorithm:SHA1,transforms:[C14N]});
  signer.addReference({xpath:"/*[@id='comprobante']",digestAlgorithm:SHA1,transforms:[DS+'enveloped-signature',C14N],id:referenceId});
  signer.computeSignature(xml,{prefix:'ds',attrs:{Id:signatureId,'xmlns:etsi':XADES},location:{reference:'/*',action:'append'}});
  const signed=signer.getSignedXml();if(!verifyXml(signed,material.certificatePem))throw new AppError(500,'SIGNATURE_VERIFICATION_FAILED','No se pudo verificar la firma generada.');return signed;
}
function verifyXml(xml,certificatePem) {
  try{const doc=parseXml(xml),signatures=doc.getElementsByTagNameNS(DS,'Signature');if(signatures.length!==1||doc.documentElement.nodeName!=='factura')return false;
    const verifier=new SignedXml({publicCert:certificatePem,getCertFromKeyInfo:()=>null});verifier.loadSignature(signatures[0]);if(!verifier.checkSignature(xml))return false;
    const signed=verifier.getSignedReferences();return signed.length===3&&signed.some(value=>{const root=parseXml(value).documentElement;return root.nodeName==='factura'&&root.getAttribute('id')==='comprobante';});
  }catch(_){return false;}
}
function certificateFromXml(xml){const doc=parseXml(xml),nodes=doc.getElementsByTagNameNS(DS,'X509Certificate');if(nodes.length!==1||!canonicalBase64(nodes[0].textContent))throw new AppError(502,'INVALID_SIGNED_CERTIFICATE','La factura no conserva un certificado válido.');try{const raw=Buffer.from(nodes[0].textContent,'base64');if(raw.toString('base64')!==nodes[0].textContent)throw new Error();return new crypto.X509Certificate(raw).toString();}catch(_){throw new AppError(502,'INVALID_SIGNED_CERTIFICATE','La factura no conserva un certificado válido.');}}
module.exports={escape,parseXml,encrypt,decrypt,readCertificate,signXml,verifyXml,certificateFromXml,opensslPath,opensslAvailable,DS,XADES,serialize:node=>new XMLSerializer().serializeToString(node)};
