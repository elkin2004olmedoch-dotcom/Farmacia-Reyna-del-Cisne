import {appendCompanionCards,safeCompanionHref} from './companion-cards.js';
let sequence=0;
/** Native controls shared by both pets. User and catalog text never becomes HTML. */
export function companionControls(item,result,send){
  appendCompanionCards(item,result.visualSummary);
  const commands=[];
  for(const action of result.actions||[]){
    if(action.href!==undefined){const href=safeCompanionHref(action.href);if(href){const link=document.createElement('a');link.className='companion-result-link';link.href=href;link.textContent=action.label;item.append(link);}}
    else commands.push(action);
  }
  if(!result.fields?.length && !commands.length){if(item.parentElement)item.parentElement.scrollTop=item.parentElement.scrollHeight;return;}
  const form=document.createElement('form');form.className='companion-controls';
  for(const field of result.fields||[]){
    const label=document.createElement('label'),control=document.createElement(field.options?'select':'input');
    control.id='companion-field-'+(++sequence);control.name=field.name;control.autocomplete='off';control.required=field.required!==false;label.htmlFor=control.id;label.textContent=field.label;
    if(field.options){for(const option of field.options){const node=document.createElement('option');node.value=option.value;node.textContent=option.label;control.append(node);}}
    else{control.type=field.type||'text';for(const key of ['min','max','step','maxLength'])if(field[key]!==undefined)control[key]=field[key];}
    if(field.value!==undefined)control.value=field.value;
    form.append(label,control);
  }
  const actions=commands.length?commands:[{label:'Revisar antes de confirmar',submit:true}];
  for(const action of actions){const button=document.createElement('button');button.type=action.submit?'submit':'button';button.textContent=action.label;
    if(!action.submit)button.addEventListener('click',()=>{if(!button.disabled)void send(action.command,action.label);});form.append(button);}
  form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())void send(result.submit(Object.fromEntries(new FormData(form))),'Revisar los datos seleccionados');});item.append(form);item.parentElement.scrollTop=item.parentElement.scrollHeight;
}
export function disableCompanionControls(root){for(const form of root.querySelectorAll('.companion-controls')){for(const control of form.querySelectorAll('button,input,select'))control.disabled=true;form.remove();}}
