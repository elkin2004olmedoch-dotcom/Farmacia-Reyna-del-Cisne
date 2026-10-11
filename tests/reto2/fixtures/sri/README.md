Fuentes públicas para validar estructura XML en pruebas; ningún dato de producción ni firma privada.

- `factura_V2.1.0.xsd`: archivo oficial de [XML y XSD Factura del SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/05546998-6f29-4870-be3b-62650f312a6c/XML%20y%20XSD%20Factura.zip), publicado en su [página de facturación electrónica](https://www.sri.gob.ec/facturacion-electronica). Conservado sin modificar.
- `xmldsig-core-schema.xsd`: [esquema XMLDSig del W3C](https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd), dependencia local del XSD del SRI. Conservado sin modificar.

`sri-xsd.test.cjs` utiliza Python con `lxml` para validar el XML firmado contra ambos archivos, con red y entidades externas desactivadas. `SRI_XSD_PYTHON` permite indicar el ejecutable. Si no está disponible, la prueba se marca como omitida; las pruebas de firma, SOAP, seguridad y persistencia sí se ejecutan con Node/OpenSSL.
