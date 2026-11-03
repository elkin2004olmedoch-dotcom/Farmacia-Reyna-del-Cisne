// Señales de estado independientes del DOM; los controladores deciden la UI.
export const events=new EventTarget();
export function dataChanged(){
  events.dispatchEvent(new Event('data:changed'));
  // Sólo una señal: nunca se comparten tokens, cuentas ni datos de pedidos.
  try{localStorage.setItem('farmacia-mvc-datos-actualizados',crypto.randomUUID());}catch(_){}
}
