import '../models/ecuador.js';
import {auth} from '../models/auth.js';
import {mfaAccount,mfaPrompt} from './mfa.js';
import {accountView} from '../views/layout.js';
import {formErrors,message,busy} from '../views/common.js';
import {connectVerificationResend} from './email-verification.js';
const V=globalThis.Farmacia.validation;
export function accountController() {
  const next=new URLSearchParams(location.search).get('next');
  const destination=['checkout.html','pedidos.html','admin.html','instalar-admin.html','entregas.html','pagos.html'].includes(next) || /^(seguimiento|pagos|entregas)\.html\?pedido=[a-zA-Z0-9_-]{1,100}$/.test(next)?next:null;
  const deliveryDestination=destination==='entregas.html' || destination?.startsWith('entregas.html?pedido=');
  if(auth.user){
    accountView(auth.user);
    if(auth.isAdmin)void mfaAccount();
    const form=document.getElementById('profile-form'),status=document.getElementById('profile-status'),cancel=document.getElementById('profile-cancel');let saving=false;
    function restore(){form.elements.nombre.value=auth.user.nombre;form.elements.telefono.value=auth.user.telefono;formErrors(form,{});}
    cancel.addEventListener('click',()=>{if(saving)return;restore();status.textContent='Cambios descartados.';form.elements.nombre.focus();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(saving)return;
      const values={nombre:form.elements.nombre.value.trim(),telefono:form.elements.telefono.value.trim()},issues={};
      if(!V.validName(values.nombre))issues.nombre='Usa letras y espacios en tu nombre completo (2 a 80 caracteres).';
      if(!V.normalizePhone(values.telefono))issues.telefono='Escribe un teléfono ecuatoriano válido.';
      if(!formErrors(form,issues)){status.textContent='Revisa los campos indicados.';return;}
      const controls=[...form.querySelectorAll('input,button')];saving=true;for(const control of controls)control.disabled=true;status.textContent='Guardando tu perfil…';
      try{const user=await auth.updateProfile(values);restore();document.getElementById('profile-greeting').textContent=`Hola, ${user.nombre}.`;status.textContent='Perfil actualizado.';}
      catch(error){const fields=Object.fromEntries((error.details||[]).map(issue=>[issue.field,issue.message]));for(const control of controls)control.disabled=false;formErrors(form,fields);status.textContent=error.message||'No se pudo actualizar el perfil. Inténtalo nuevamente.';}
      finally{saving=false;for(const control of controls)control.disabled=false;}
    });
    return;
  }
  const note=sessionStorage.getItem('farmacia-mvc-login-message');if(note){message(note,false);sessionStorage.removeItem('farmacia-mvc-login-message');}
  const login=document.getElementById('login-panel');const register=document.getElementById('register-panel');
  const pending=document.getElementById('email-pending-panel');
  connectVerificationResend(document.getElementById('verification-resend-form'));
  function showPending(email,text){
    login.hidden=true;register.hidden=true;pending.hidden=false;
    document.getElementById('verification-email').value=email;
    document.getElementById('email-pending-message').textContent=text;
    for(const input of document.querySelectorAll('[name=password],[name=confirm]'))input.value='';
    pending.setAttribute('tabindex','-1');pending.focus();
  }
  function switchPanel(show){pending.hidden=true;login.hidden=show;register.hidden=!show;(show?register:login).querySelector('input').focus();message('');}
  document.getElementById('email-back-login').addEventListener('click',event=>{event.preventDefault();switchPanel(false);});
  document.getElementById('show-register').addEventListener('click',()=>switchPanel(true));document.getElementById('show-login').addEventListener('click',()=>switchPanel(false));
  for(const form of document.querySelectorAll('[data-auth-form]'))form.addEventListener('submit',async event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(form));const issues={};
    if(!V.validEmail(values.email))issues.email='Escribe un correo válido.';
    if(!values.password)issues.password='Escribe tu contraseña.';
    const registering=form.id==='register-form';
    if(registering){if(!V.validName(values.nombre))issues.nombre='Usa letras y espacios en tu nombre completo.';if(!V.normalizePhone(values.telefono))issues.telefono='Escribe un teléfono de Ecuador válido.';if(!V.validCedula(values.cedula))issues.cedula='Escribe una cédula ecuatoriana válida.';if(values.password.length<10 || new TextEncoder().encode(values.password).length>72 || !/\p{L}/u.test(values.password)||!/\d/.test(values.password))issues.password='Usa al menos 10 caracteres, letra y número (máximo 72 bytes).';if(values.confirm!==values.password)issues.confirm='Las contraseñas deben coincidir.';if(!values.terms)issues.terms='Acepta las condiciones para continuar.';}
    if(!formErrors(form,issues)){message('Revisa los campos indicados.',true);return;}
    const button=form.querySelector('[type=submit]');busy(button,true);
    try{if(registering){const {nombre,email,telefono,cedula,password}=values;const result=await auth.register({nombre,email,telefono,cedula,password});if(result.requiresEmailVerification){showPending(email,result.message);form.reset();return;}}else{const result=await auth.login({email:values.email,password:values.password});form.elements.password.value='';if(result?.mfaRequired){await mfaPrompt(result.challenge);}}location.assign(auth.isAdmin?(destination==='instalar-admin.html' || deliveryDestination?destination:'admin.html'):auth.isCourier?(deliveryDestination?destination:'entregas.html'):destination || 'cuenta.html');}
    catch(error){if(error.code==='EMAIL_NOT_VERIFIED'){showPending(values.email,error.message);return;}if(registering&&error.code==='EMAIL_UNAVAILABLE'){message('Para crear tu cuenta necesitas confirmar el correo. Ahora no podemos enviar el mensaje; inténtalo más tarde.',true);return;}const fields=Object.fromEntries((error.details || []).map(issue=>[issue.field,issue.message]));if(Object.keys(fields).length)formErrors(form,fields);message(error.message,true);}finally{busy(button,false);}
  });
  for(const button of document.querySelectorAll('[data-password]'))button.addEventListener('click',()=>{const input=document.getElementById(button.dataset.password);input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Mostrar contraseña':'Ocultar contraseña';button.setAttribute('aria-pressed',String(input.type==='text'));});
}
