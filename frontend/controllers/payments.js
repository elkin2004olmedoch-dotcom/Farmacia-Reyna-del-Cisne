import {payments,payphoneUrl,demoOrder,demoResult} from '../models/payments.js';
import {paymentSummary,paymentOutcome} from '../views/payments.js';
import {money,busy} from '../views/common.js';
import {requireUser} from './layout.js';
import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
export async function paymentsController(){
  const params=new URLSearchParams(location.search),id=params.get('pedido');
  const form=document.getElementById('payment-form'),methods=document.getElementById('payment-methods'),button=document.getElementById('payment-submit');
  const errorPanel=document.getElementById('payment-error'),loading=document.getElementById('payment-loading');
  let order=demoOrder,config={payphone:{disponible:false,entorno:null}},payment=null,pending=false,loadingActive=false,active=true;
  const card=form.querySelector('[value=card]'),manual=form.querySelector('[value=manual]'),demo=form.querySelector('[value=demo]');
  function fail(error){document.getElementById('payment-error-message').textContent=error.message;errorPanel.hidden=false;}
  function render(){
    if(!active)return;
    const real=Boolean(id),method=form.elements.method.value;
    const locked=payment && ['creando','aprobado','cancelado','revision'].includes(payment.estado);
    const mismatch=payment && config.payphone.entorno && payment.entorno!==config.payphone.entorno;
    card.disabled=!real || !config.payphone.disponible || !order.id || ['cancelado','entregado'].includes(order.estado) || Boolean(locked || mismatch);
    document.getElementById('payment-card-note').textContent=mismatch?'El entorno de este intento cambió. Consulta su revisión con la farmacia.':!config.payphone.disponible?'PayPhone · pendiente de activación':!real?'PayPhone · requiere un pedido registrado':(payment?.entorno || config.payphone.entorno)==='sandbox'?'PayPhone · entorno de pruebas, sin cobros reales':'Procesado en la página oficial de PayPhone';
    document.getElementById('payment-demo-panel').hidden=method!=='demo';
    document.getElementById('payment-method-note').textContent=method==='demo'?'Demostración independiente. Ningún cobro real.':method==='card'?'Continuarás en pay.payphonetodoesposible.com. Al terminar, volverás a la farmacia.':'Habla con nuestro equipo para acordar el pago. Un mensaje no acredita un pago.';
    button.textContent=method==='demo'?`Probar pago de ${money(order.totalCentavos)} →`:method==='card'?`Continuar en PayPhone · ${money(order.totalCentavos)} →`:'Consultar con la farmacia ↗';
    button.disabled=pending || real && !order.id || method==='card' && card.disabled;
    document.getElementById('payment-mode').textContent=!real?'Demostración · sin cobros':(payment?.entorno || config.payphone.entorno)==='sandbox'?'PayPhone · entorno de pruebas':'Pago de tu pedido';
    document.getElementById('payment-refresh').hidden=!real;
    document.getElementById('payment-refresh').disabled=loadingActive || pending;
    if(payment){const state=document.getElementById('payment-persisted-state');const labels={creando:'La solicitud de pago se está preparando. Actualiza el estado antes de volver a intentar.',pendiente:'Solicitud pendiente. Continúa con la misma solicitud de PayPhone; no se ha confirmado un pago.',aprobado:payment.entorno==='sandbox'?'Prueba de PayPhone aprobada. No es un pago real del pedido.':'Pago verificado por PayPhone. La preparación y la entrega continúan por separado.',cancelado:'PayPhone informó una cancelación. Consulta con la farmacia antes de iniciar otro pago.',revision:'Este intento necesita revisión. Consulta con la farmacia; no vuelvas a pagar hasta conciliarlo.'};state.textContent=labels[payment.estado] || 'Consulta con la farmacia el estado del pago.';state.hidden=false;}
  }
  if(id && (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || params.getAll('pedido').length!==1)){
    methods.disabled=true;button.disabled=true;document.getElementById('payment-summary').textContent='El enlace del pedido no es válido.';fail(new Error('Abre el pago desde Mis pedidos.'));document.getElementById('payment-retry').hidden=true;return;
  }
  if(id){
    if(!requireUser(`pagos.html?pedido=${id}`))return;
    demo.checked=false;manual.checked=true;document.getElementById('payment-demo-method').hidden=true;demo.disabled=true;document.getElementById('payment-demo-link').hidden=false;
    document.getElementById('payment-back').href='pedidos.html';document.getElementById('payment-back').textContent='Volver a mis pedidos →';
    order={...demoOrder,id:null,detalles:[]};document.getElementById('payment-summary').textContent='Consultando el importe guardado de tu pedido…';
    function expire(){
      if(!active)return;active=false;order=null;payment=null;methods.disabled=true;button.disabled=true;form.hidden=true;
      document.getElementById('payment-summary').textContent='Inicia sesión para consultar este pedido.';
      document.getElementById('payment-reference').textContent='';document.getElementById('payment-persisted-state').textContent='';
      location.replace('cuenta.html?next='+encodeURIComponent(`pagos.html?pedido=${id}`));
    }
    events.addEventListener('session:expired',expire);events.addEventListener('session:changed',()=>{if(!auth.user)expire();});
  }else paymentSummary(order);
  async function load(){
    if(pending || loadingActive)return;loadingActive=true;pending=Boolean(id);errorPanel.hidden=true;loading.hidden=!id;methods.disabled=Boolean(id);render();
    try{if(id){const data=await payments.forOrder(id);if(!active)return;order=data.pedido;payment=data.pago;config=data;paymentSummary(order);}else config=await payments.configuration();}
    catch(error){fail(error);if(error.status===401)requireUser(`pagos.html?pedido=${id}`);}
    finally{pending=false;loadingActive=false;loading.hidden=true;if(active){methods.disabled=Boolean(id && !order.id);render();}}
  }
  form.addEventListener('change',render);
  form.addEventListener('submit',async event=>{
    event.preventDefault();const method=form.elements.method.value;
    if(!active || pending || id && (!order.id || method==='demo') || method==='card' && card.disabled)return;
    errorPanel.hidden=true;
    if(method==='demo'){paymentOutcome(demoResult(document.getElementById('payment-demo-result').value));return;}
    if(method==='manual'){const url=new URL('https://api.whatsapp.com/send');url.searchParams.set('phone','593979275988');url.searchParams.set('text',id?`Hola, quiero coordinar el pago del pedido ${id}.`:'Hola, quiero consultar las formas de pago de la farmacia.');window.open(url.href,'_blank','noopener,noreferrer');return;}
    pending=true;busy(button,true);
    try{const result=await payments.prepare(id);if(!active)return;payment=result.pago;config=result;if(payment?.estado==='pendiente' && payment.urlPago){location.assign(payphoneUrl(payment.urlPago));return;}render();}
    catch(error){fail(error);if(error.status===401)requireUser(`pagos.html?pedido=${id}`);}
    finally{pending=false;if(active){busy(button,false);render();}}
  });
  document.getElementById('payment-reset').addEventListener('click',()=>{document.getElementById('payment-result').hidden=true;form.hidden=false;render();document.getElementById('payment-demo-result').focus();});
  document.getElementById('payment-retry').addEventListener('click',()=>void load());
  document.getElementById('payment-refresh').addEventListener('click',()=>void load());
  render();void load();
}
