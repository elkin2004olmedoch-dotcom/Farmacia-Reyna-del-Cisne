export const money=cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(cents/100);
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const price=product=>money(Math.round(Number(product.precio)*100));
export const priceMarkup=product=>product.descuentoPorcentaje>0?`<span class="price-with-discount"><del><span class="sr-only">Precio anterior: </span>${money(Math.round(Number(product.precioOriginal)*100))}</del><strong>${price(product)}</strong></span>`:`<strong>${price(product)}</strong>`;
export const promotionRibbon=(percentage,preview=false)=>preview?'<span class="promotion-preview">Vista previa · sin descuento aplicado</span>':percentage>0?`<span class="promotion-ribbon">PROMO · ${escape(percentage)}% de descuento</span>`:'';
export const taxMarkup=product=>[0,13,14,15].includes(product.ivaPorcentaje)?`<span class="tax-note">${product.ivaPorcentaje===0?'Tarifa IVA 0 %':'Precio final · incluye IVA '+escape(product.ivaPorcentaje)+' %'}</span>`:'';
export function message(text,error=false,focus=false) {
  const area=document.getElementById('page-status');area.textContent=text;area.classList.toggle('is-error',error);area.setAttribute('role',error?'alert':'status');area.hidden=!text;if(focus)area.focus();
}
export function formErrors(form,issues) {
  for(const field of form.querySelectorAll('input,select,textarea')) {
    const error=issues[field.name];field.setAttribute('aria-invalid',String(Boolean(error)));let note=document.getElementById(field.id+'-error');
    if(!note && field.id && !['hidden','radio','submit','button'].includes(field.type)){note=document.createElement('span');note.id=field.id+'-error';note.className='field-error';field.after(note);}
    if(note){note.textContent=error || '';note.hidden=!error;const descriptions=new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));descriptions.add(note.id);field.setAttribute('aria-describedby',[...descriptions].join(' '));}
  }
  const first=form.elements.namedItem(Object.keys(issues)[0]);first?.focus?.();return !Object.keys(issues).length;
}
export function openConfirmation(text) {
  const dialog=document.getElementById('confirm-dialog');dialog.querySelector('p').textContent=text;
  const previous=document.activeElement;dialog.returnValue='';dialog.showModal();dialog.querySelector('[value=cancel]').focus();
  return {dialog,previous};
}
export function busy(button,pending){button.disabled=pending;button.setAttribute('aria-busy',String(pending));}
