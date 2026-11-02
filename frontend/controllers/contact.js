import '../models/ecuador.js';
import {formErrors,message} from '../views/common.js';
import {isClassroom} from '../models/runtime.js';
export function contactController() {
  document.getElementById('home-map-load')?.addEventListener('click',()=>{
    if(isClassroom){message('El mapa de la farmacia no forma parte de la simulación. Usa el seguimiento de un pedido de clase.');return;}
    const frame=document.createElement('iframe');frame.title='Mapa de ubicación de Farmacia Reina del Cisne';frame.referrerPolicy='no-referrer';
    frame.src='https://www.google.com/maps?q=Farmacia%20Reina%20del%20Cisne%20Puerto%20Quito&output=embed';
    document.getElementById('home-map-panel').replaceChildren(frame);
  },{once:true});
  const form=document.getElementById('contact-form');if(!form)return;
  document.getElementById('contact-clear-saved')?.addEventListener('click',()=>{form.reset();formErrors(form,{});document.getElementById('form-success').hidden=true;message('Formulario limpio.');});
  form.addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));if(!formErrors(form,globalThis.Farmacia.validation.validate(values))){message('Revisa los datos de tu consulta.',true);return;}const text=`Hola, soy ${values.name}. Mi correo es ${values.email} y mi teléfono ${values.phone}. Consulta: ${values.message}`;document.getElementById('contact-whatsapp').href='https://api.whatsapp.com/send?phone=593979275988&text='+encodeURIComponent(text);document.getElementById('form-success').hidden=false;message('Consulta lista. Revisa el mensaje en WhatsApp antes de enviarlo.');});
}
