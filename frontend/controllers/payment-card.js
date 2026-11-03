import '../models/ecuador.js';
import '../models/card-policy.js';
import {formErrors} from '../views/common.js';
import {practiceCardView} from '../views/payments.js';
export function paymentCardController(root){
 const template=document.createElement('template');template.innerHTML=practiceCardView();
 const widget=template.content.querySelector('#payment-card-widget'),dialog=template.content.querySelector('dialog');root.replaceChildren(widget);document.body.append(dialog);
 const form=dialog.querySelector('form'),trigger=widget.querySelector('button'),summary=widget.querySelector('[role=status]'),brand=dialog.querySelector('#payment-practice-brand');
 const cards=globalThis.Farmacia.cards,validation=globalThis.Farmacia.validation,help=dialog.querySelector('#payment-cvv-help'),helpTrigger=dialog.querySelector('#payment-cvv-trigger');let selected=null;
 function hideHelp(){help.hidden=true;helpTrigger.setAttribute('aria-expanded','false');}
 function resetRaw(){form.reset();formErrors(form,{});brand.textContent='Marca por identificar';hideHelp();}
 function open(){if(trigger.disabled)return;resetRaw();dialog.showModal();form.elements.cardNumber.focus();}
 function clear(){selected=null;summary.textContent='Aún no agregaste una tarjeta.';trigger.textContent='Agregar tarjeta →';if(dialog.open)dialog.close();resetRaw();}
 function format(input,transform){const count=input.value.slice(0,input.selectionStart??input.value.length).replace(/\D/g,'').length;input.value=transform(input.value);let offset=0,digits=0;while(offset<input.value.length&&digits<count){if(/\d/.test(input.value[offset]))digits++;offset++;}input.setSelectionRange(offset,offset);}
 form.elements.cardNumber.addEventListener('input',event=>{format(event.target,cards.formatNumber);const value=cards.detectBrand(event.target.value);brand.textContent=value?cards.brands[value]:'Marca por identificar';form.elements.cvv.maxLength=value==='amex'?4:3;dialog.querySelector('#payment-cvv-description').textContent=value==='amex'?'Busca los 4 dígitos en el frente de la tarjeta.':'Busca los 3 dígitos en el reverso de la tarjeta.';});
 form.elements.expiry.addEventListener('input',event=>format(event.target,cards.formatExpiry));
 form.elements.cvv.addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,Number(event.target.maxLength));});
 trigger.addEventListener('click',open);
 for(const cancel of dialog.querySelectorAll('[data-card-cancel]'))cancel.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{resetRaw();if(trigger.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});});
 helpTrigger.addEventListener('click',()=>{help.hidden=!help.hidden;helpTrigger.setAttribute('aria-expanded',String(!help.hidden));if(!help.hidden)help.querySelector('button').focus();});
 dialog.querySelector('#payment-cvv-understood').addEventListener('click',()=>{hideHelp();helpTrigger.focus();});
 form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();const values=Object.fromEntries(new FormData(form));if(!formErrors(form,validation.validateCard(values,new Date(),cards.detectBrand)))return;const key=cards.detectBrand(values.cardNumber);selected={brand:key,last4:values.cardNumber.replace(/\D/g,'').slice(-4)};summary.textContent=`${cards.brands[key]} •••• ${selected.last4}`;trigger.textContent='Cambiar tarjeta →';dialog.close();resetRaw();});
 const expire=()=>clear();window.addEventListener('pagehide',expire);
 return {open,clear,get brand(){return selected?.brand||null;},setDisabled(value){trigger.disabled=value;},destroy(){clear();window.removeEventListener('pagehide',expire);dialog.remove();root.replaceChildren();}};
}
