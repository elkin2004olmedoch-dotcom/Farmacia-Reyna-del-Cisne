// La demostración usa claves y credenciales sintéticas distintas de la tienda.
const MODE='farmacia-modalidad-clase';
function classroomMode(){
  if(!globalThis.location || !globalThis.sessionStorage)return false;
  const query=new URLSearchParams(location.search);
  if(query.get('demo')==='salir'){sessionStorage.removeItem(MODE);return false;}
  const active=query.get('demo')==='clase' || /\/clase(?:\.html)?\/?$/.test(location.pathname) || sessionStorage.getItem(MODE)==='clase';
  if(active)sessionStorage.setItem(MODE,'clase');
  return active;
}
export const isClassroom=classroomMode();
export const storageKey=name=>isClassroom?name.replace(/^farmacia-mvc-/,'farmacia-clase-'):name;
const requestedRole=globalThis.location?new URLSearchParams(location.search).get('rol'):null;
const savedRole=isClassroom?sessionStorage.getItem(storageKey('farmacia-mvc-token'))?.replace(/^clase-/,''):null;
export const classroomRole=['user','admin','repartidor'].includes(requestedRole)?requestedRole:['user','admin','repartidor'].includes(savedRole)?savedRole:'user';
if(isClassroom)sessionStorage.setItem(storageKey('farmacia-mvc-token'),'clase-'+classroomRole);
