import {payments,payphoneUrl} from '../models/payments.js';
import {paymentSummary,practiceCardView} from '../views/payments.js';
import '../models/card-policy.js';
import {money,busy} from '../views/common.js';
import {requireUser} from './layout.js';
import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
export async function paymentsController(){
  const params=new URLSearchParams(location.search),id=params.get('pedido');
  const form=document.getElementById('payment-form'),methods=document.getElementById('payment-methods'),button=document.getElementById('payment-submit');
  const errorPanel=document.getElementById('payment-error'),loading=document.getElementById('payment-loading');
  const transferPanel=document.getElementById('payment-transfer-panel'),copy=document.getElementById('payment-transfer-copy'),copyStatus=document.getElementById('payment-transfer-copy-status');
  const practiceCard=document.getElementById('payment-practice-card'),practiceFields=document.getElementById('payment-practice-fields'),practiceResult=document.getElementById('payment-practice-result'),cards=globalThis.Farmacia.cards;
  let order={id:null,totalCentavos:0,detalles:[]},config={payphone:{disponible:false,entorno:null}},payment=null,pending=false,loadingActive=false,active=true;
  const card=form.querySelector('[value=card]'),transfer=form.querySelector('[value=transfer]');
  function fail(error){document.getElementById('payment-error-message').textContent=error.message;errorPanel.hidden=false;}
  function apply(data){order=data.pedido;payment=data.pago;config=data;paymentSummary(order);}
  function contact(text){const url=new URL('https://api.whatsapp.com/send');url.searchParams.set('phone','593979275988');url.searchParams.set('text',text);window.open(url.href,'_blank','noopener,noreferrer');}
  function render(){
    if(!active)return;
    const real=Boolean(id),method=form.elements.method.value,bank=config.transferencia,bankAvailable=bank?.disponible===true,practice=config.practica?.disponible===true,result=config.practica?.resultado,practiceDone=practice&&Boolean(result);
    const locked=payment && ['creando','aprobado','cancelado','revision'].includes(payment.estado);
    const mismatch=payment && config.payphone.entorno && payment.entorno!==config.payphone.entorno;
    const fallbackBlocked=!config.payphone.disponible && Boolean(payment),closed=['cancelado','entregado'].includes(order.estado);
    card.disabled=!real || !order.id || closed || practiceDone || practice&&Boolean(payment) || Boolean(locked || mismatch || fallbackBlocked);
    transfer.disabled=!real || !order.id || closed || practiceDone || Boolean(payment);
    transferPanel.hidden=method!=='transfer' || transfer.disabled;copy.disabled=pending || loadingActive || transfer.disabled;
    document.getElementById('payment-bank-details').hidden=!bankAvailable;
    for(const [field,value]of Object.entries({name:bank?.banco,type:bank?.tipo==='ahorros'?'Ahorros':bank?.tipo==='corriente'?'Corriente':'',number:bank?.numeroCuenta,holder:bank?.titular}))document.getElementById('payment-bank-'+field).textContent=bankAvailable?value:'';
    document.getElementById('payment-transfer-intro').textContent=bankAvailable?'Transfiere el importe exacto a esta cuenta e incluye la referencia de tu pedido. Envía el comprobante a la farmacia para que revise la recepción.':'Solicita los datos bancarios a la farmacia y confirma con su equipo cómo realizar el pago.';
    copy.textContent=bankAvailable?'Copiar datos de transferencia':'Copiar importe y referencia';
    document.getElementById('payment-transfer-note').textContent=payment?'Consulta la solicitud existente con la farmacia antes de elegir otra forma de pago.':bankAvailable?`${bank.banco} · Cuenta de ${bank.tipo}`:'Solicita los datos bancarios y usa la referencia de tu pedido.';
    document.getElementById('payment-card-note').textContent=mismatch?'El entorno de este intento cambió. Consulta su revisión con la farmacia.':fallbackBlocked?'Ya existe una solicitud de pago. Consulta su estado con la farmacia antes de solicitar otro enlace.':!config.payphone.disponible?'Solicita un enlace seguro a la farmacia. No ingreses datos de tarjeta aquí.':!real?'PayPhone · requiere un pedido registrado':(payment?.entorno || config.payphone.entorno)==='sandbox'?'PayPhone · entorno de pruebas, sin cobros reales':'Procesado en la página oficial de PayPhone';
    document.getElementById('payment-method-note').textContent=method==='card'?(fallbackBlocked?'Ya existe una solicitud de pago. Revisa su estado o contacta con la farmacia.':config.payphone.disponible?'Ingresarás y validarás tu tarjeta en la página oficial de PayPhone. Al terminar, volverás a la farmacia.':'Se abrirá WhatsApp para solicitar un enlace seguro. La solicitud no realiza un cobro; la verificación del pago queda pendiente.'):method==='transfer'?(bankAvailable?'La transferencia queda pendiente hasta que la farmacia compruebe su recepción. Copiar los datos o enviar el comprobante no confirma el pago.':'Solicita por WhatsApp los datos bancarios para este pedido. Copiar la referencia o enviar un mensaje no confirma una transferencia.'):'Habla con nuestro equipo para acordar el pago. Un mensaje no acredita un pago.';
    button.textContent=method==='card'?(config.payphone.disponible?`Pagar con tarjeta en PayPhone · ${money(order.totalCentavos)} →`:'Solicitar enlace seguro ↗'):method==='transfer'?(bankAvailable?'Enviar comprobante a la farmacia ↗':'Solicitar datos bancarios ↗'):'Consultar con la farmacia ↗';
    button.disabled=pending || real && !order.id || (method==='card'?card.disabled:method==='transfer'?transfer.disabled:method!=='manual');
    document.getElementById('payment-mode').textContent=!real?'Mis compras':'Pago de tu pedido';
    document.getElementById('payment-refresh').hidden=!real;
    document.getElementById('payment-refresh').disabled=loadingActive || pending;
    if(!payment){const state=document.getElementById('payment-persisted-state');state.textContent='Pago por coordinar con la farmacia.';state.hidden=false;}
    if(payment){const state=document.getElementById('payment-persisted-state');const labels={creando:'La solicitud de pago se está preparando. Actualiza el estado antes de volver a intentar.',pendiente:'Solicitud pendiente. Continúa con la misma solicitud de PayPhone; no se ha confirmado un pago.',aprobado:payment.entorno==='sandbox'?'Prueba de PayPhone aprobada. No es un pago real del pedido.':'Pago verificado por PayPhone. La preparación y la entrega continúan por separado.',cancelado:'PayPhone informó una cancelación. Consulta con la farmacia antes de iniciar otro pago.',revision:'Este intento necesita revisión. Consulta con la farmacia; no vuelvas a pagar hasta conciliarlo.'};state.textContent=labels[payment.estado] || 'Consulta con la farmacia el estado del pago.';state.hidden=false;}
    form.hidden=practiceDone;practiceResult.hidden=!result;
    if(result){document.getElementById('payment-practice-summary').textContent=`${result.metodo==='card'?(cards.brands[result.marca]||'Tarjeta'):'Transferencia'} · ${money(result.totalCentavos)}`;if(!payment){const state=document.getElementById('payment-persisted-state');state.textContent='El recorrido de práctica se completó. No se ha realizado un cobro ni una transferencia bancaria.';state.hidden=practiceDone;}}
    document.getElementById('payment-legal-note').hidden=practice&&!payment;
    if(practice){
      document.getElementById('payment-mode').textContent='Sin cobro real';
      document.getElementById('payment-card-note').textContent='Visa, Mastercard y otras marcas. Reconocimiento de marca, sin cobro real.';
      document.getElementById('payment-method-note').textContent=method==='manual'?'Habla con nuestro equipo para acordar el pago.':'El botón completa el recorrido de práctica sin mover dinero.';
      document.getElementById('payment-transfer-intro').textContent='Completa el recorrido con el botón Pagar. No realices una transferencia bancaria para esta práctica.';
      if(method!=='manual')button.textContent='Pagar';
      if(!practiceFields.childElementCount){practiceFields.innerHTML=practiceCardView();practiceFields.querySelector('input').addEventListener('input',event=>{const brand=cards.detectBrand(event.target.value);document.getElementById('payment-practice-brand').textContent=brand?cards.brands[brand]:'Marca por identificar';});}
    }else practiceFields.replaceChildren();
    practiceCard.hidden=!practice||method!=='card'||card.disabled;
    const number=document.getElementById('payment-practice-number');if(number){number.disabled=pending||practiceCard.hidden;if(practiceCard.hidden){number.value='';document.getElementById('payment-practice-brand').textContent='Marca por identificar';}}
  }
  if(id && (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || params.getAll('pedido').length!==1)){
    methods.disabled=true;button.disabled=true;document.getElementById('payment-summary').textContent='El enlace del pedido no es válido.';fail(new Error('Abre el pago desde Mis pedidos.'));document.getElementById('payment-retry').hidden=true;return;
  }
  if(id){
    if(!requireUser(`pagos.html?pedido=${id}`))return;
    const requested=params.getAll('metodo').length===1 && ['card','transfer','manual'].includes(params.get('metodo'))?params.get('metodo'):'manual';
    form.querySelector(`[value="${requested}"]`).checked=true;
    document.getElementById('payment-back').href='pedidos.html';document.getElementById('payment-back').textContent='Volver a mis pedidos →';
    order={id:null,totalCentavos:0,detalles:[]};document.getElementById('payment-summary').textContent='Consultando el importe guardado de tu pedido…';
    function expire(){
      if(!active)return;active=false;order=null;payment=null;methods.disabled=true;button.disabled=true;form.hidden=true;
      document.getElementById('payment-summary').textContent='Inicia sesión para consultar este pedido.';
      document.getElementById('payment-reference').textContent='';document.getElementById('payment-persisted-state').textContent='';
      for(const field of ['payment-transfer-amount','payment-transfer-reference','payment-transfer-copy-status','payment-bank-name','payment-bank-type','payment-bank-number','payment-bank-holder'])document.getElementById(field).textContent='';
      document.getElementById('payment-bank-details').hidden=true;
      practiceFields.replaceChildren();practiceResult.hidden=true;document.getElementById('payment-practice-summary').textContent='';
      location.replace('cuenta.html?next='+encodeURIComponent(`pagos.html?pedido=${id}`));
    }
    events.addEventListener('session:expired',expire);events.addEventListener('session:changed',()=>{if(!auth.user)expire();});
  }else{form.hidden=true;document.getElementById('payment-refresh').hidden=true;document.getElementById('payment-summary').innerHTML='<p>Elige un pedido para consultar su importe y las opciones disponibles.</p><a class="button button-primary" href="pedidos.html">Ver mis pedidos →</a>';return;}
  async function load(){
    if(pending || loadingActive)return;loadingActive=true;pending=Boolean(id);errorPanel.hidden=true;loading.hidden=!id;methods.disabled=Boolean(id);render();
    try{if(id){const data=await payments.forOrder(id);if(!active)return;apply(data);}else config=await payments.configuration();}
    catch(error){fail(error);if(error.status===401)requireUser(`pagos.html?pedido=${id}`);}
    finally{pending=false;loadingActive=false;loading.hidden=true;if(active){methods.disabled=Boolean(id && !order.id);render();}}
  }
  form.addEventListener('change',()=>{copyStatus.textContent='';render();});
  copy.addEventListener('click',async()=>{
    if(!active || pending || !order.id || transfer.disabled || form.elements.method.value!=='transfer')return;
    busy(copy,true);
    try{const bank=config.transferencia;const details=bank?.disponible?`Banco: ${bank.banco}\nTipo: ${bank.tipo}\nCuenta: ${bank.numeroCuenta}\nTitular: ${bank.titular}\n`:'';await navigator.clipboard.writeText(details+`Pedido: ${order.id}\nImporte: ${money(order.totalCentavos)}`);if(active)copyStatus.textContent=details?'Datos de transferencia copiados.':'Importe y referencia copiados.';}
    catch{if(active)copyStatus.textContent='No se pudo copiar. Puedes seleccionar el importe y la referencia que aparecen arriba.';}
    finally{if(active)busy(copy,false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();const method=form.elements.method.value;
    if(!active || pending || id && (!order.id) || !['card','transfer','manual'].includes(method) || method==='card' && card.disabled || method==='transfer' && transfer.disabled)return;
    errorPanel.hidden=true;
    if(method==='manual'){contact(`Hola, quiero coordinar el pago del pedido ${id}.`);return;}
    if(config.practica?.disponible){
      const number=document.getElementById('payment-practice-number'),marca=method==='card'?cards.detectBrand(number?.value):null;
      if(method==='card'&&!marca){fail(new Error('Escribe un número inventado con longitud y marca reconocidas.'));number?.focus();return;}
      if(number)number.value='';pending=true;busy(button,true);render();
      try{const data=await payments.practice(id,{metodo:method,...(marca?{marca}:{})});if(!active)return;apply(data);render();practiceResult.focus();}
      catch(error){if(active)fail(error);}
      finally{pending=false;if(active){busy(button,false);render();}}return;
    }
    if(method==='transfer'){contact(config.transferencia?.disponible?`Hola, quiero enviar el comprobante de transferencia de ${money(order.totalCentavos)} por el pedido ${id}. Quedo pendiente de la verificación del pago.`:`Hola, solicito los datos bancarios para transferir ${money(order.totalCentavos)} por el pedido ${id}. Quedo pendiente de la verificación del pago.`);return;}
    if(!config.payphone.disponible){contact(`Hola, solicito un enlace seguro para pagar ${money(order.totalCentavos)} por el pedido ${id}. Quedo pendiente de la verificación del pago.`);return;}
    pending=true;busy(button,true);
    try{const result=await payments.prepare(id);if(!active)return;payment=result.pago;config=result;if(payment?.estado==='pendiente' && payment.urlPago){location.assign(payphoneUrl(payment.urlPago));return;}render();}
    catch(error){fail(error);if(error.status===401)requireUser(`pagos.html?pedido=${id}`);}
    finally{pending=false;if(active){busy(button,false);render();}}
  });
  document.getElementById('payment-retry').addEventListener('click',()=>void load());
  document.getElementById('payment-refresh').addEventListener('click',()=>void load());
  render();void load();
}
