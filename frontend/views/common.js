export const money=cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(cents/100);
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const price=product=>money(Math.round(Number(product.precio)*100));
export function message(text,error=false,focus=false) {
  const area=document.getElementById('page-status');area.textContent=text;area.classList.toggle('is-error',error);area.setAttribute('role',error?'alert':'status');area.hidden=!text;if(focus)area.focus();
}
export function formErrors(form,issues) {
  for(const field of form.querySelectorAll('input,select,textarea')) {
    const error=issues[field.name];field.setAttribute('aria-invalid',String(Boolean(error)));const note=document.getElementById(field.id+'-error');if(note){note.textContent=error || '';note.hidden=!error;}
  }
  const first=form.elements.namedItem(Object.keys(issues)[0]);first?.focus?.();return !Object.keys(issues).length;
}
export function openConfirmation(text) {
  const dialog=document.getElementById('confirm-dialog');dialog.querySelector('p').textContent=text;
  const previous=document.activeElement;dialog.returnValue='';dialog.showModal();dialog.querySelector('[value=cancel]').focus();
  return {dialog,previous};
}
export function busy(button,pending){button.disabled=pending;button.setAttribute('aria-busy',String(pending));}
