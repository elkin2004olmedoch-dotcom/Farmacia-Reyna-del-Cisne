// Public configuration. The Pages build replaces only this origin; no secrets belong here.
export const apiOrigin='';
export function apiUrl(path){
  if(typeof path!=='string' || !path.startsWith('/') || path.startsWith('//') || /[\\#\r\n]/.test(path))throw new Error('Ruta API inválida.');
  return `${apiOrigin}/api${path}`;
}
export function publicImageUrl(value){
  if(typeof value!=='string' || !/^assets\/(?:images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)|uploads\/[a-f0-9-]+\.webp)$/.test(value))return 'assets/images/logo-reina-del-cisne.png';
  return apiOrigin && value.startsWith('assets/uploads/')?`${apiOrigin}/${value}`:value;
}
