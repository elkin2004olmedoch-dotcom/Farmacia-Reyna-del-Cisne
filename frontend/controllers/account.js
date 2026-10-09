import '../models/ecuador.js';
import {auth} from '../models/auth.js';
import {accountView} from '../views/layout.js';
import {formErrors,message,busy} from '../views/common.js';
const V=globalThis.Farmacia.validation;
export function accountController() {
  const next=new URLSearchParams(location.search).get('next');const destination=['checkout.html','pedidos.html','admin.html'].includes(next)?next:null;
  if(auth.user){accountView(auth.user);return;}
  const note=sessionStorage.getItem('farmacia-mvc-login-message');if(note){message(note,false);sessionStorage.removeItem('farmacia-mvc-login-message');}
  const login=document.getElementById('login-panel');const register=document.getElementById('register-panel');
  function switchPanel(show){login.hidden=show;register.hidden=!show;(show?register:login).querySelector('input').focus();message('');}
  document.getElementById('show-register').addEventListener('click',()=>switchPanel(true));document.getElementById('show-login').addEventListener('click',()=>switchPanel(false));
  for(const form of document.querySelectorAll('[data-auth-form]'))form.addEventListener('submit',async event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(form));const issues={};
    if(!V.validEmail(values.email))issues.email='Escribe un correo válido.';
    if(!values.password)issues.password='Escribe tu contraseña.';
    const registering=form.id==='register-form';
    if(registering){if(!V.validName(values.nombre))issues.nombre='Usa letras y espacios en tu nombre completo.';if(!V.normalizePhone(values.telefono))issues.telefono='Escribe un teléfono de Ecuador válido.';if(!V.validCedula(values.cedula))issues.cedula='Escribe una cédula ecuatoriana válida.';if(values.password.length<10 || new TextEncoder().encode(values.password).length>72 || !/\p{L}/u.test(values.password)||!/\d/.test(values.password))issues.password='Usa al menos 10 caracteres, letra y número (máximo 72 bytes).';if(values.confirm!==values.password)issues.confirm='Las contraseñas deben coincidir.';if(!values.terms)issues.terms='Acepta las condiciones para continuar.';}
    if(!formErrors(form,issues)){message('Revisa los campos indicados.',true);return;}
    const button=form.querySelector('[type=submit]');busy(button,true);
    try{if(registering){const {nombre,email,telefono,cedula,password}=values;await auth.register({nombre,email,telefono,cedula,password});}else await auth.login({email:values.email,password:values.password});location.assign(auth.isAdmin?'admin.html':destination || 'cuenta.html');}
    catch(error){const fields=Object.fromEntries(error.details.map(issue=>[issue.field,issue.message]));if(Object.keys(fields).length)formErrors(form,fields);message(error.message,true);}finally{busy(button,false);}
  });
  for(const button of document.querySelectorAll('[data-password]'))button.addEventListener('click',()=>{const input=document.getElementById(button.dataset.password);input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Mostrar contraseña':'Ocultar contraseña';button.setAttribute('aria-pressed',String(input.type==='text'));});
}
