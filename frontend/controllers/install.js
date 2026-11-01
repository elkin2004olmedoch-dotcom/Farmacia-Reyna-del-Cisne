import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {requireUser} from './layout.js';

let initialized=false,adminInitialized=false,adminAuthorized=false;
let deferredPrompt=null,installing=false,installed=false,standalone=false,selectedPlatform='',notice='';
const standaloneGuide='Esta página está abierta en una ventana de aplicación. Para instalar la tienda o la administración por separado, abre esta página en el navegador Edge o Chrome; en iPhone, usa Safari.';
const node=id=>document.getElementById(id);
function currentPlatform(){
  const ua=navigator.userAgent || '';
  if(/iPad|iPhone|iPod/i.test(ua) || /Macintosh/i.test(ua) && navigator.maxTouchPoints>1)return 'ios';
  if(/Android/i.test(ua))return 'android';
  return /Windows/i.test(ua)?'windows':'browser';
}
function guidance(platform){
  return {
    android:'En Android, abre esta tienda en Chrome. Usa «Instalar aplicación» o «Añadir a pantalla de inicio» en el menú si está disponible.',
    ios:'En iPhone o iPad, abre esta tienda en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». Confirma con «Añadir». No requiere App Store.',
    windows:'En Windows, abre esta página en Microsoft Edge o Chrome. Usa el icono de instalación de la barra de direcciones o «Instalar esta página como aplicación» en el menú si está disponible.',
    browser:'Abre la tienda en Chrome para Android, Safari para iPhone o Microsoft Edge/Chrome para Windows y sigue las opciones de instalación del navegador.'
  }[platform];
}
const administrative=()=>['admin','admin-install'].includes(document.body.dataset.page);
function render(){
  const platform=currentPlatform();
  const ready=Boolean(deferredPrompt) && !installing && !installed && !standalone;
  const action=node('app-install-action');
  if(action){action.disabled=!(ready && !administrative() && selectedPlatform===platform && platform!=='ios');action.hidden=action.disabled;}
  const guide=node('install-guidance');
  if(guide)guide.textContent=selectedPlatform===platform?(installed?'Instalación confirmada por el dispositivo.':standalone?standaloneGuide:notice || guidance(platform)):guidance(selectedPlatform);
  for(const button of document.querySelectorAll('[data-install-platform]'))button.setAttribute('aria-pressed',String(button.dataset.installPlatform===selectedPlatform));
  const adminAction=node('admin-install-action');
  if(adminAction)adminAction.disabled=!(ready && adminAuthorized && auth.isAdmin && platform==='windows');
  const adminStatus=node('admin-install-status');
  if(adminStatus && adminInitialized)adminStatus.textContent=!adminAuthorized?'Inicia sesión con una cuenta de administrador para instalar la administración.':installed?'Instalación confirmada por el dispositivo.':standalone?standaloneGuide:notice || guidance('windows');
}
async function promptInstall(admin=false){
  if(admin){
    if(!requireUser('instalar-admin.html',true)){revokeAdmin();return;}
    if(!adminAuthorized || currentPlatform()!=='windows')return;
  }else if(administrative() || selectedPlatform!==currentPlatform() || currentPlatform()==='ios')return;
  if(!deferredPrompt || installing || installed || standalone)return;
  const prompt=deferredPrompt;deferredPrompt=null;installing=true;notice='Sigue la confirmación del navegador.';render();
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    notice=choice.outcome==='accepted'?'Solicitud aceptada. Espera la confirmación del dispositivo.':'Instalación cancelada o pospuesta. Puedes usar el menú del navegador o reintentar cuando vuelva a ofrecerla. '+guidance(admin?'windows':selectedPlatform);
  }catch(_){notice='No se pudo abrir la instalación. '+guidance(admin?'windows':selectedPlatform);}
  finally{installing=false;render();}
}
function revokeAdmin(){
  adminAuthorized=false;
  if(adminInitialized && node('admin-area'))node('admin-area').hidden=true;
  render();
}
export function installController(){
  if(initialized)return;
  initialized=true;selectedPlatform=currentPlatform();
  standalone=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;notice='';render();});
  window.addEventListener('appinstalled',()=>{installed=true;deferredPrompt=null;notice='';render();});
  events.addEventListener('session:changed',()=>{if(!auth.isAdmin)revokeAdmin();});
  events.addEventListener('session:expired',revokeAdmin);
  const dialog=node('app-install-dialog');let previous;
  for(const button of document.querySelectorAll('[data-app-open]'))button.addEventListener('click',()=>{previous=document.activeElement;render();if(dialog && !dialog.open){dialog.showModal();node('app-install-close')?.focus();}});
  node('app-install-close')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('close',()=>{if(previous?.isConnected)previous.focus();});
  for(const button of document.querySelectorAll('[data-install-platform]'))button.addEventListener('click',()=>{selectedPlatform=button.dataset.installPlatform;render();});
  node('app-install-action')?.addEventListener('click',()=>void promptInstall());
  if(isSecureContext && 'serviceWorker' in navigator)navigator.serviceWorker.register('/app-worker.js',{scope:'/'}).catch(()=>{});
  render();
}
export function adminInstallController(){
  installController();
  if(adminInitialized)return;
  adminInitialized=true;
  if(!requireUser('instalar-admin.html',true)){revokeAdmin();return;}
  adminAuthorized=auth.isAdmin;
  if(node('admin-area'))node('admin-area').hidden=!adminAuthorized;
  node('admin-install-action')?.addEventListener('click',()=>void promptInstall(true));
  render();
}
