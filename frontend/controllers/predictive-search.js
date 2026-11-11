import {catalog} from '../models/catalog.js';
import {productImageUrl} from '../config.js';
import {price} from '../views/common.js';


// Manual selection keeps Enter useful for the full catalogue and avoids choosing a medicine for the user.
export function predictiveSearch(input,{filters=()=>({})}={}) {
  if(!input)return;
  const wrapper=document.createElement('div');wrapper.className='predictive-control';
  input.before(wrapper);wrapper.append(input);
  const panel=document.createElement('div');panel.className='predictive-panel';panel.hidden=true;
  const note=document.createElement('p');note.className='predictive-note';
  const list=document.createElement('ul');list.id=input.id+'-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Productos sugeridos');
  const hint=document.createElement('p');hint.className='predictive-hint';hint.textContent='Enter para buscar · Flechas para elegir';
  panel.append(note,list,hint);wrapper.append(panel);
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');wrapper.append(status);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
  let timer,controller,version=0,active=-1;
  function close(){clearTimeout(timer);controller?.abort();version++;panel.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function choose(index){
    const options=[...list.querySelectorAll('[role="option"]')];active=index;
    for(const [i,option] of options.entries())option.setAttribute('aria-selected',String(i===active));
    if(active<0)input.removeAttribute('aria-activedescendant');
    else{input.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}
  }
  async function search(){
    const q=input.value.trim();close();if(q.length<2 || document.activeElement!==input)return;
    const current=version;controller=new AbortController();
    try{
      const result=await catalog.suggestions(q,{...filters(),signal:controller.signal});
      if(current!==version || document.activeElement!==input)return;
      list.replaceChildren();
      const items=result.items.slice(0,6);
      note.textContent=result.aproximadas?'Coincidencias aproximadas. Revisa nombre y presentación.':items.length?'Productos que coinciden con tu búsqueda':'Sin coincidencias. Prueba otro nombre o presentación.';
      for(const [index,product] of items.entries()){
        const option=document.createElement('li');option.setAttribute('role','presentation');
        const link=document.createElement('a');link.id=list.id+'-'+index;link.setAttribute('role','option');link.setAttribute('aria-selected','false');link.href='producto.html?id='+encodeURIComponent(product.id);link.tabIndex=-1;
        const image=document.createElement('img');image.src=productImageUrl(product.imagen);image.alt='';image.width=48;image.height=56;image.dataset.productImage='';
        const copy=document.createElement('span');copy.className='predictive-copy';
        const name=document.createElement('strong');name.textContent=product.nombre;
        const meta=document.createElement('small');meta.textContent=[product.presentacion,product.laboratorio].filter(Boolean).join(' · ');
        const amount=document.createElement('span');amount.className='predictive-price';amount.textContent=price(product);
        copy.append(name,meta);link.append(image,copy,amount);option.append(link);list.append(option);
      }
      panel.hidden=false;input.setAttribute('aria-expanded','true');status.textContent=(result.aproximadas?note.textContent+' ':'')+items.length+' sugerencias disponibles.';
    }catch(error){if(current===version && error.name!=='AbortError'){close();status.textContent='No se pudieron cargar sugerencias. Puedes buscar con Enter.';}}
  }
  function schedule(){close();if(input.value.trim().length>=2)timer=setTimeout(search,220);}
  input.addEventListener('input',schedule);input.addEventListener('focus',schedule);
  input.addEventListener('blur',()=>{if(!wrapper.contains(document.activeElement))close();});
  list.addEventListener('mousedown',event=>{if(event.button===0)event.preventDefault();});
  list.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){const opened=!panel.hidden;event.preventDefault();close();if(opened)event.stopPropagation();return;}
    if(panel.hidden)return;
    const options=list.querySelectorAll('[role="option"]'),length=options.length;
    if(length && ['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();choose(event.key==='ArrowDown'?(active+1)%length:(active<0?length-1:(active+length-1)%length));}
    if(event.key==='Enter' && active>=0){event.preventDefault();location.assign(options[active].href);close();}
    if(event.key==='Tab')close();
  });
  window.addEventListener('pagehide',close);
  return {close};
}
