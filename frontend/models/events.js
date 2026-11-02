// Señales de estado independientes del DOM; los controladores deciden la UI.
import {storageKey} from './runtime.js';
export const events=new EventTarget();
export function dataChanged(){
  events.dispatchEvent(new Event('data:changed'));
  // Sólo una señal: nunca se comparten tokens, cuentas ni datos de pedidos.
  try{localStorage.setItem(storageKey('farmacia-mvc-datos-actualizados'),crypto.randomUUID());}catch(_){}
}
