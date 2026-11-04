import '../models/ecuador.js';
import {auth,sessionSignalKey} from '../models/auth.js';
import {busy,formErrors} from '../views/common.js';

const V=globalThis.Farmacia.validation;
const resendMessage='Si hay una cuenta pendiente con ese correo, recibirás un nuevo enlace. Espera un minuto antes de volver a solicitarlo.';
const confirmations=new WeakMap();
function status(node,text,error=false){
  node.textContent=text;node.classList.toggle('is-error',error);node.setAttribute('role',error?'alert':'status');
}

export function connectVerificationResend(form=document.getElementById('verification-resend-form')){
  if(!form || form.dataset.verificationConnected)return;
  form.dataset.verificationConnected='true';
  const message=document.getElementById('verification-resend-status'),button=form.querySelector('[type=submit]');
  let pending=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    const email=form.elements.email.value.trim();
    if(!formErrors(form,V.validEmail(email)?{}:{email:'Escribe el correo electrónico de tu cuenta.'})){status(message,'Revisa el correo indicado.',true);return;}
    const wasFocused=document.activeElement===button;
    pending=true;busy(button,true);status(message,'Solicitando un nuevo correo…');
    try{const result=await auth.resendVerification(email);status(message,result?.message || resendMessage);}
    catch(error){status(message,error.message || 'No se pudo solicitar el correo. Inténtalo nuevamente.',true);}
    finally{pending=false;busy(button,false);if(wasFocused && form.isConnected && document.activeElement===document.body)button.focus({preventScroll:true});}
  });
}

// Attach only while the pending panel is open. A signal never carries an identity.
export function connectVerificationSession(panel,onVerified){
  let connection=null,checking=false,queued=null,revision=0,expected='',lastFocusCheck=-Infinity;
  const normalize=value=>String(value || '').trim().toLowerCase();
  function stop(){connection?.abort();connection=null;queued=null;expected='';}
  async function check(event,retry=false){
    if(!panel.isConnected || panel.hidden){stop();return;}
    if(!connection)return;
    if(event.type==='storage'){
      if(event.key!==sessionSignalKey || event.storageArea!==localStorage || !event.newValue)return;
    }
    if(event.type!=='storage' && document.visibilityState==='hidden')return;
    if(checking){revision++;queued=event;return;}
    if(event.type!=='storage'){
      if(!retry && performance.now()-lastFocusCheck<1000)return;
      lastFocusCheck=performance.now();
    }
    const active=connection,matchingEmail=expected,request=++revision;checking=true;
    try{
      const user=await auth.restore({accept:user=>request===revision && connection===active && !active.signal.aborted && panel.isConnected && !panel.hidden && normalize(user?.email)===matchingEmail});
      if(user){stop();onVerified();}
    }catch{}finally{checking=false;if(queued && connection){const next=queued;queued=null;void check(next,true);}}
  }
  function watch(email){
    stop();expected=normalize(email);lastFocusCheck=-Infinity;connection=new AbortController();
    const options={signal:connection.signal};
    window.addEventListener('storage',check,options);window.addEventListener('focus',check,options);
    window.addEventListener('pageshow',check,options);document.addEventListener('visibilitychange',check,options);
    window.addEventListener('pagehide',event=>{if(!event.persisted)stop();},options);
  }
  return {watch,stop};
}

function readVerificationToken(){
  const fragment=location.hash,hasQuery=Boolean(location.search);
  history.replaceState(null,'',location.pathname);
  return hasQuery?null:/^#token=([A-Za-z0-9_-]{43})$/.exec(fragment)?.[1] || null;
}

export function emailVerificationController(){
  const hasLink=Boolean(location.hash || location.search),initialToken=readVerificationToken();
  const panel=document.getElementById('verification-confirm-panel');
  if(!panel)return;
  const connected=confirmations.get(panel);if(connected){if(hasLink)connected(initialToken);return;}
  panel.dataset.verificationConnected='true';connectVerificationResend();
  const message=document.getElementById('verification-status'),button=document.getElementById('verification-submit'),pendingPanel=document.getElementById('email-pending-panel');
  let token=null,pending=false,completed=false,generation=0;
  function invalid(){
    token=null;button.disabled=true;pendingPanel.hidden=false;
    status(message,'Este enlace no es válido o ya venció. Solicita un nuevo correo de confirmación.',true);
  }
  function acceptLink(value){
    generation++;token=value;pending=false;completed=false;busy(button,false);button.textContent='Confirmar y entrar';button.disabled=!token;pendingPanel.hidden=Boolean(token);
    if(!token){invalid();return;}
    status(message,'Al confirmar, tu sesión de cliente se iniciará y volverás a la tienda. El correo se confirma sólo cuando pulses el botón.');
  }
  function locationChanged(event){
    // A history traversal may emit both events; popstate can already have removed the fragment.
    const alreadyClean=event.type==='hashchange' && !location.hash && !location.search && Boolean(new URL(event.newURL || location.href,location.href).hash);
    const next=readVerificationToken();if(!alreadyClean)acceptLink(next);
  }
  confirmations.set(panel,acceptLink);window.addEventListener('hashchange',locationChanged);window.addEventListener('popstate',locationChanged);acceptLink(initialToken);
  button.addEventListener('click',async()=>{
    if(!token || pending)return;
    const wasFocused=document.activeElement===button,request=generation;
    pending=true;busy(button,true);button.textContent='Confirmando…';status(message,'Estamos confirmando tu correo…');
    try{
      const result=await auth.verifyEmail(token);
      if(request!==generation)return;
      if(result?.verified!==true)throw new Error('No se pudo confirmar el correo. Inténtalo nuevamente.');
      token=null;completed=true;pendingPanel.hidden=true;
      if(result.usuario?.role==='user'){
        auth.save(result);location.replace('catalogo.html');return;
      }
      status(message,'Correo confirmado. Ya puedes iniciar sesión');message.focus();
    }catch(error){
      if(request!==generation)return;
      if(error.code==='EMAIL_VERIFICATION_INVALID'){invalid();message.focus();}
      else status(message,error.message && !error.message.includes(token)?error.message:'No se pudo confirmar el correo. Inténtalo nuevamente.',true);
    }finally{
      if(request===generation){
        pending=false;busy(button,false);button.disabled=!token;
        button.textContent=completed?'Correo confirmado':token?'Volver a intentar':'Confirmar y entrar';
        if(token && wasFocused && document.activeElement===document.body)button.focus({preventScroll:true});
      }
    }
  });
}
