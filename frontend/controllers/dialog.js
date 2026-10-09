import {openConfirmation} from '../views/common.js';
export function confirmAction(text) {
  const {dialog,previous}=openConfirmation(text);
  return new Promise(resolve=>dialog.addEventListener('close',()=>{previous?.isConnected && previous.focus();resolve(dialog.returnValue==='confirm');},{once:true}));
}
