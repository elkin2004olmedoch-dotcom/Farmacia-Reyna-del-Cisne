import {createNativeRuntime} from './native.js';
import {createSession} from './session.js';
import {createTracker} from './tracker.js';
import {mountApp} from './ui.js';

const root=document.getElementById('app');
try{
  const runtime=await createNativeRuntime();
  const session=createSession(runtime);
  let view;
  const tracker=createTracker({session,gps:runtime.gps,onStatus:status=>view?.updateTracking(status)});
  view=await mountApp({root,session,tracker,runtime});
}catch(error){
  const message=document.createElement('p');message.className='startup';message.setAttribute('role','alert');
  message.textContent=error.code==='NATIVE_REQUIRED'?error.message:'No se pudo preparar el almacenamiento seguro de la app. Cierra y vuelve a abrirla; si continúa, contacta con la farmacia.';
  root.replaceChildren(message);
}
