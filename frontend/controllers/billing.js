import '../models/ecuador.js';
import {billing,downloadInvoice} from '../models/billing.js';
import {billingView,invoicesView,invoiceStates} from '../views/billing.js';
import {formErrors,busy,message,escape} from '../views/common.js';
import {confirmAction} from './dialog.js';
import {preserveFocus} from './updates.js';
const ec=()=>globalThis.Farmacia.validation;
const uuid=value=>/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value || '');
const clean=value=>String(value || '').trim();
const serverIssues=details=>Array.isArray(details)?Object.fromEntries(details.map(issue=>[issue.field,issue.message])):details && typeof details==='object'?details:{};
function text(value,min=2,max=300){const s=clean(value);return s.length>=min && s.length<=max && /\p{L}/u.test(s) && !/[<>\x00-\x1f]/.test(s);}
function configurationStatus(config){
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  set('billing-certificate-info',config.certificado?.presente?`Certificado registrado${config.certificado.venceEn?' · vence '+new Intl.DateTimeFormat('es-EC',{dateStyle:'medium',timeZone:'America/Guayaquil'}).format(new Date(config.certificado.venceEn)):''}.`:'Todavía no hay un certificado registrado.');
  set('billing-next-sequence',`Próximo secuencial de esta serie: ${config.proximoSecuencial || 1}.`);
  const environment=document.querySelector('.billing-environment');if(environment)environment.textContent=config.ambiente==='2'?'Producción: los comprobantes autorizados tienen validez tributaria.':'Ambiente de pruebas: los comprobantes no tienen validez tributaria.';
}
function issuesFor(form){
  const v=Object.fromEntries(new FormData(form)),issues={};
  if(form.id==='billing-config-form'){
    if(!ec().validRuc(v.ruc))issues.ruc='Escribe el RUC de 13 dígitos terminado en 001. Confirma su inscripción en el SRI.';
    if(!text(v.razonSocial))issues.razonSocial='Escribe la razón social registrada (2 a 300 caracteres).';
    if(clean(v.nombreComercial) && !text(v.nombreComercial))issues.nombreComercial='Usa de 2 a 300 caracteres para el nombre comercial.';
    for(const key of ['direccionMatriz','direccionEstablecimiento'])if(!text(v[key],8))issues[key]='Escribe calle, numeración o s/n y referencia (8 a 300 caracteres).';
    for(const key of ['establecimiento','puntoEmision'])if(!/^\d{3}$/.test(v[key]) || v[key]==='000')issues[key]='Escribe un código de tres dígitos registrado en el SRI; por ejemplo 001.';
    if(!['1','2'].includes(v.ambiente))issues.ambiente='Selecciona el ambiente SRI.';
    if(v.ambiente==='2' && !form.elements.confirmarProduccion.checked)issues.confirmarProduccion='Confirma expresamente la habilitación de producción.';
    if(!form.elements.softwarePropio.checked && !ec().validRuc(v.rucProveedorSoftware))issues.rucProveedorSoftware='Registra el RUC real del proveedor del software (13 dígitos terminados en 001).';
    else if(clean(v.rucProveedorSoftware) && !ec().validRuc(v.rucProveedorSoftware))issues.rucProveedorSoftware='Revisa el RUC del proveedor del software.';
    if(clean(v.secuencialInicial) && (!/^\d{1,9}$/.test(v.secuencialInicial) || Number(v.secuencialInicial)<1))issues.secuencialInicial='Usa un secuencial de 1 a 999999999 mayor a los comprobantes anteriores.';
  }else if(form.id==='billing-draft-form'){
    if(!uuid(v.pedidoId))issues.pedidoId='Copia el identificador completo del pedido (36 caracteres).';
    if(!['04','05'].includes(v.tipoIdentificacion))issues.tipoIdentificacion='Selecciona cédula o RUC.';
    else if(!(v.tipoIdentificacion==='04'?ec().validRuc(v.identificacionComprador):ec().validCedula(v.identificacionComprador)))issues.identificacionComprador=v.tipoIdentificacion==='04'?'RUC inválido: revisa sus 13 dígitos terminados en 001.':'Cédula inválida: revisa sus 10 dígitos y el verificador.';
    if(!text(v.razonSocialComprador))issues.razonSocialComprador='Escribe el nombre o razón social del comprador (2 a 300 caracteres).';
    if(!text(v.direccionComprador,8))issues.direccionComprador='Escribe una dirección con calle, numeración o s/n y referencia.';
    if(!ec().validEmail(v.correoComprador))issues.correoComprador='Escribe un correo electrónico válido.';
    if(!['01','16','19','20'].includes(v.formaPago))issues.formaPago='Selecciona la forma de pago real del pedido antes de facturar.';
  }else{
    const file=form.elements.archivo.files[0];
    if(!file || !/\.(p12|pfx)$/i.test(file.name) || file.size<1 || file.size>2*1024*1024)issues.archivo='Selecciona un certificado P12 o PFX de hasta 2 MB.';
    if(!v.password || v.password.length>200)issues.password='Escribe la contraseña del certificado (hasta 200 caracteres).';
  }
  return issues;
}
export function billingController(){
  const area=document.getElementById('admin-billing');let config,result,page=1,loading=false,requestId=0;
  async function refresh(){const id=++requestId,requested=page;const loaded=await billing.invoices(requested);if(id!==requestId || requested!==page || !area.isConnected || area.hidden)return;result=loaded;preserveFocus(document.getElementById('billing-table'),()=>invoicesView(result));}
  async function render({silent=false}={}){
    if(silent){if(!loading && config)await refresh();return;}
    const id=++requestId;loading=true;area.setAttribute('aria-busy','true');area.innerHTML='<p class="admin-card admin-empty" role="status">Cargando facturación electrónica…</p>';
    try{const loaded=await Promise.all([billing.configuration(),billing.invoices(page)]);if(id!==requestId || !area.isConnected)return;[config,result]=loaded;billingView(config,result);configurationStatus(config);const pedido=new URLSearchParams(location.search).get('pedido');if(uuid(pedido))document.getElementById('billing-draft-form').elements.pedidoId.value=pedido;if(config.capacidades?.opensslDisponible===false){document.getElementById('billing-certificate-info').textContent+=' El servidor requiere OpenSSL para importar la firma. Contacta al responsable de la instalación.';document.querySelector('#billing-certificate-form [type=submit]').disabled=true;}}
    catch(error){area.innerHTML='<p class="admin-card admin-empty">No se pudo cargar la facturación. Vuelve a seleccionar Facturación SRI para intentar nuevamente.</p>';throw error;}
    finally{loading=false;area.removeAttribute('aria-busy');}
  }
  area.addEventListener('submit',async event=>{
    const form=event.target;if(!['billing-config-form','billing-certificate-form','billing-draft-form'].includes(form.id))return;event.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;
    const status=form.querySelector('[role=status]');const issues=issuesFor(form);if(!formErrors(form,issues)){status.textContent='Revisa los campos indicados.';return;}
    const v=Object.fromEntries(new FormData(form));let action;
    if(form.id==='billing-config-form'){
      const values={...Object.fromEntries(['ruc','razonSocial','nombreComercial','direccionMatriz','direccionEstablecimiento','establecimiento','puntoEmision','ambiente','rucProveedorSoftware'].map(key=>[key,clean(v[key]) || null])),obligadoContabilidad:form.elements.obligadoContabilidad.checked,softwarePropio:form.elements.softwarePropio.checked,confirmarProduccion:form.elements.confirmarProduccion.checked,...(clean(v.secuencialInicial)?{secuencialInicial:Number(v.secuencialInicial)}:{})};
      if(values.ambiente==='2' && !await confirmAction('¿Guardar estos datos reales y habilitar facturación en producción? Cada emisión necesitará una confirmación adicional.'))return;
      action=async()=>{config=await billing.saveConfiguration(values);configurationStatus(config);form.elements.confirmarProduccion.checked=false;form.elements.nombreComercial.value=config.nombreComercial || '';form.elements.secuencialInicial.value='';status.textContent='Configuración del emisor guardada.';};
    }else if(form.id==='billing-draft-form'){
      action=async()=>{await billing.create(Object.fromEntries(Object.entries(v).map(([key,value])=>[key,clean(value)])));form.reset();page=1;await refresh();status.textContent='Borrador creado. Revisa el comprobante antes de firmar y enviar al SRI.';};
    }else{
      const file=form.elements.archivo.files[0],password=v.password;
      action=async()=>{try{const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);await billing.uploadCertificate({archivoBase64:btoa(binary),password});config=await billing.configuration();document.getElementById('billing-certificate-info').textContent=`Certificado registrado${config.certificado?.venceEn?' · vence '+new Intl.DateTimeFormat('es-EC',{dateStyle:'medium',timeZone:'America/Guayaquil'}).format(new Date(config.certificado.venceEn)):''}.`;status.textContent='Firma electrónica protegida y guardada en el servidor.';}finally{form.elements.archivo.value='';form.elements.password.value='';}};
    }
    const previous=document.activeElement;const controls=Array.from(form.elements).filter(el=>!el.disabled && el!==button);for(const control of controls)control.disabled=true;busy(button,true);status.textContent='Guardando…';let errors;
    try{await action();}catch(error){status.textContent=error.message;errors=serverIssues(error.details);}finally{for(const control of controls)control.disabled=false;busy(button,false);if(errors && Object.keys(errors).length)formErrors(form,errors);else if(previous?.isConnected && form.contains(previous))previous.focus();}
  });
  area.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button || button.type==='submit' && button.closest('form') || button.disabled)return;const wasFocused=document.activeElement===button;
    try{
      if(button.id==='billing-prev' || button.id==='billing-next'){page+=button.id==='billing-next'?1:-1;await refresh();return;}
      if(button.id==='billing-refresh'){await refresh();message('Comprobantes actualizados.');return;}
      const id=button.dataset.invoiceEmit || button.dataset.invoiceXml || button.dataset.invoiceRide;if(!id)return;
      if(button.dataset.invoiceEmit){const invoice=result.items.find(item=>item.id===id);const production=invoice.ambiente==='2';if(!await confirmAction(production?'¿Firmar y enviar esta factura real al SRI en producción? Verifica el pedido y la identificación del comprador.':'¿Firmar y enviar esta factura al ambiente de pruebas del SRI? No tendrá validez tributaria.'))return;busy(button,true);const saved=await billing.emit(id,production);await refresh();document.getElementById('billing-emission-status').textContent=`Estado: ${invoiceStates[saved.estado] || saved.estado}. ${saved.mensaje || ''}`;document.getElementById('billing-refresh').focus();}
      else{busy(button,true);await downloadInvoice(id,button.dataset.invoiceXml?'xml':'ride');message('Comprobante descargado.');}
    }catch(error){message(error.message,true);}finally{if(button.isConnected){busy(button,false);if(wasFocused)button.focus();}}
  });
  return {render};
}
export function connectCustomerInvoices(area){
  area.addEventListener('click',async event=>{
    const button=event.target.closest('[data-order-invoice],[data-customer-invoice-xml],[data-customer-invoice-ride]');if(!button || button.disabled)return;const wasFocused=document.activeElement===button;busy(button,true);
    try{if(button.dataset.orderInvoice){const invoice=await billing.own(button.dataset.orderInvoice);const status=document.getElementById('invoice-'+button.dataset.orderInvoice);status.innerHTML=invoice?`${escape(invoiceStates[invoice.estado] || invoice.estado)} · ${invoice.validezTributaria?'Comprobante de producción con validez tributaria.':invoice.ambiente==='1'?'Ambiente de PRUEBAS: sin validez tributaria.':'Sin autorización de producción con validez tributaria.'}${invoice.xmlDisponible?` <button class="text-link" data-customer-invoice-xml="${escape(invoice.id)}">Descargar XML</button>`:''}${invoice.rideDisponible?` <button class="text-link" data-customer-invoice-ride="${escape(invoice.id)}">Descargar RIDE</button>`:''}`:'La farmacia todavía no ha creado una factura para este pedido.';}
      else await downloadInvoice(button.dataset.customerInvoiceXml || button.dataset.customerInvoiceRide,button.dataset.customerInvoiceXml?'xml':'ride',{customer:true});
    }catch(error){message(error.message,true);}finally{if(button.isConnected){busy(button,false);if(wasFocused && (document.activeElement===document.body || document.activeElement===button))button.focus();}}
  });
}
