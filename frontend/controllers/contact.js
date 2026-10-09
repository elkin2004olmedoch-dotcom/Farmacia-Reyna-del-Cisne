import '../models/ecuador.js';
import {formErrors,message} from '../views/common.js';
export function contactController() {
  const form=document.getElementById('contact-form');if(!form)return;
  document.getElementById('contact-clear-saved')?.addEventListener('click',()=>{form.reset();formErrors(form,{});document.getElementById('form-success').hidden=true;message('Formulario limpio.');});
  form.addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));if(!formErrors(form,globalThis.Farmacia.validation.validate(values))){message('Revisa los datos de tu consulta.',true);return;}const text=`Hola, soy ${values.name}. Mi correo es ${values.email} y mi teléfono ${values.phone}. Consulta: ${values.message}`;document.getElementById('contact-whatsapp').href='https://wa.me/593979275988?text='+encodeURIComponent(text);document.getElementById('form-success').hidden=false;message('Consulta lista. Revisa el mensaje en WhatsApp antes de enviarlo.');});
}
