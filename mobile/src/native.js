import {Capacitor, CapacitorHttp, registerPlugin} from '@capacitor/core';
import {SecureStorage, KeychainAccess} from '@aparajita/capacitor-secure-storage';
import {LocalNotifications} from '@capacitor/local-notifications';

const API_ORIGIN='https://farmacia-reina-del-cisne.onrender.com';
const BackgroundGeolocation=registerPlugin('BackgroundGeolocation');
const failure=(code,message)=>Object.assign(new Error(message),{code});

// Injecting native boundaries permits deterministic tests; production uses only the
// registered Android/iOS plugins. In particular, SecureStorage's web fallback is forbidden.
export async function createNativeRuntime({platform=Capacitor.getPlatform(),http=CapacitorHttp,secureStorage=SecureStorage,gps=BackgroundGeolocation,notifications=LocalNotifications,random=globalThis.crypto}={}){
  if(!['android','ios'].includes(platform))throw failure('NATIVE_REQUIRED','Instala la app de reparto en Android o iPhone para compartir ubicación en segundo plano.');
  await secureStorage.setKeyPrefix('ec.reinadelcisne.reparto.');
  await secureStorage.setSynchronize(false);
  if(platform==='ios')await secureStorage.setDefaultKeychainAccess(KeychainAccess.afterFirstUnlockThisDeviceOnly);
  const storage={
    get:key=>secureStorage.get(key,false,false),
    set:(key,value)=>secureStorage.set(key,value,false,false,KeychainAccess.afterFirstUnlockThisDeviceOnly),
    remove:key=>secureStorage.remove(key,false),
  };
  async function transport(path,{method='GET',data,token}={}){
    if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\#\r\n]/.test(path)||/(?:^|\/)\.\.(?:\/|$|\?)/.test(path))throw failure('INVALID_PATH','Ruta de la farmacia inválida.');
    if(token!==undefined&&(typeof token!=='string'||!/^[-A-Za-z0-9_.]+$/.test(token)))throw failure('INVALID_TOKEN','La sesión guardada no es válida. Inicia sesión nuevamente.');
    let response;
    try{
      response=await http.request({url:API_ORIGIN+'/api'+path,method,headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{data}),responseType:'json',connectTimeout:15000,readTimeout:20000,disableRedirects:true});
    }catch{throw failure('NETWORK_ERROR','No se pudo conectar con la farmacia. Se reintentará al recuperar la conexión.');}
    let body=response.data;
    if(response.status===204)return {status:204,body:null};
    if(typeof body==='string')try{body=JSON.parse(body);}catch{throw failure('INVALID_RESPONSE','La farmacia devolvió una respuesta que no se pudo leer.');}
    if(!body||typeof body!=='object'||!Number.isInteger(response.status))throw failure('INVALID_RESPONSE','La farmacia devolvió una respuesta que no se pudo leer.');
    return {status:response.status,body};
  }
  async function ensureNotifications(){
    if(platform!=='android')return true;
    let permission=await notifications.checkPermissions();
    if(permission.display!=='granted')permission=await notifications.requestPermissions();
    if(permission.display!=='granted')throw failure('NOTIFICATIONS_DENIED','Permite las notificaciones de la app para mantener visible el aviso de ubicación durante la entrega.');
    return true;
  }
  function randomBytes(length){
    if(!Number.isInteger(length)||length<1||length>128||typeof random?.getRandomValues!=='function')throw failure('RANDOM_UNAVAILABLE','El dispositivo no permite crear una sesión segura.');
    return random.getRandomValues(new Uint8Array(length));
  }
  return {transport,storage,randomBytes,gps,ensureNotifications,openSettings:()=>gps.openSettings()};
}
