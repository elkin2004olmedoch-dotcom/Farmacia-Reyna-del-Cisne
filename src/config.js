// Same-origin API; Pages sets only the public origin of uploaded images. No secrets belong here.
export const apiOrigin='';
export const imageOrigin='';
export function apiUrl(path){
  if(typeof path!=='string' || !path.startsWith('/') || path.startsWith('//') || /[\\#\r\n]/.test(path))throw new Error('Ruta API inválida.');
  return `${apiOrigin}/api${path}`;
}
export function publicImageUrl(value){
  if(typeof value!=='string' || !/^assets\/(?:images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)|uploads\/[a-f0-9-]+\.webp)$/.test(value))return 'assets/images/logo-reina-del-cisne.png';
  return imageOrigin && value.startsWith('assets/uploads/')?`${imageOrigin}/${value}`:value;
}
export function productImageUrl(value){
  const url=publicImageUrl(value);
  if(['assets/images/producto-bebe-pigeon.png','assets/images/producto-solar-eucerin.png'].includes(url))return url.replace(/\.png$/,'.webp');
  return url==='assets/images/logo-reina-del-cisne.png'?'assets/images/producto-sin-imagen.svg':url;
}
