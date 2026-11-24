import {request} from '../models/api.js';
import {auth} from '../models/auth.js';
import '../models/ecuador.js';
const {validEmail}=globalThis.Farmacia.validation;
export function passwordResetController(){
 const initial=new URL(location.href),raw=initial.search?null:/^#token=([A-Za-z0-9_-]{43})$/.exec(initial.hash)?.[1];
 history.replaceState(null,'',initial.pathname);
 let token=typeof raw==='string'&&/^[A-Za-z0-9_-]{43}$/.test(raw)?raw:null;
 const ask=document.getElementById('recovery-request'),reset=document.getElementById('recovery-reset'),status=document.getElementById('recovery-status');
 if(token){ask.hidden=true;reset.hidden=false;document.getElementById('recovery-title').textContent='Elige tu nueva contraseña';}
 else if(initial.hash||initial.search){status.textContent='El enlace no es válido. Solicita uno nuevo.';}
 for(const form of [ask,reset])form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button[type=submit]');if(button.disabled)return;
  const values=Object.fromEntries(new FormData(form));
  if(form===ask&&!validEmail(values.email)){status.textContent='Escribe un correo válido.';form.elements.email.focus();return;}
  if(form===reset&&(!token||values.password.length<10||new TextEncoder().encode(values.password).length>72||!/\p{L}/u.test(values.password)||!/\d/.test(values.password)||values.password!==values.confirm)){status.textContent='Usa una contraseña de al menos 10 caracteres, con letra y número, y repítela igual.';form.elements.password.focus();return;}
  button.disabled=true;status.textContent='Procesando…';
  try{
   const result=await request(form===ask?'/auth/forgot-password':'/auth/reset-password',{method:'POST',body:form===ask?{email:values.email}:{token,password:values.password}});
   status.textContent=result.message;
   if(form===reset){token=null;form.reset();form.hidden=true;auth.clear();}else button.disabled=false;
  }catch(error){status.textContent=error.message;button.disabled=false;}
  status.focus();
 });
}
