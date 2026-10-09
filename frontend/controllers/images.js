import {administration} from '../models/admin.js';
import {imagePreviewView} from '../views/admin.js';
import {busy} from '../views/common.js';

export function imageController(form,prefix) {
  const input=document.getElementById(prefix+'-image-file');const path=form.elements.imagen;
  const submit=form.querySelector('[type=submit]');let pending=false,sequence=0,abort;
  input.addEventListener('change',async()=>{
    const file=input.files[0];if(!file)return;const id=++sequence;abort?.abort();
    const status=document.getElementById('editor-status');
    if(file.size>2*1024*1024 || !/\.(jpe?g|png|webp)$/i.test(file.name)){pending=false;busy(submit,false);status.textContent='Elige una imagen JPG, PNG o WebP de hasta 2 MB.';input.value='';return;}
    abort=new AbortController();pending=true;busy(submit,true);status.textContent='Cargando imagen…';
    try{const saved=await administration.uploadImage(file,abort.signal);if(id!==sequence)return;path.value=saved.imagen;if(!form.elements.alt.value)form.elements.alt.value='Imagen de '+(form.elements.nombre?.value || form.elements.titulo?.value || 'la farmacia');if(prefix==='promotion')form.elements.alt.required=true;imagePreviewView(prefix,saved.imagen);status.textContent='Imagen cargada. Guarda el registro para publicar el cambio.';}
    catch(error){if(id===sequence && error.name!=='AbortError')status.textContent=error.message;}
    finally{if(id===sequence){pending=false;input.value='';busy(submit,false);}}
  });
  path.addEventListener('change',()=>imagePreviewView(prefix,path.value));
  document.getElementById(prefix+'-image-reset')?.addEventListener('click',()=>{sequence++;abort?.abort();pending=false;busy(submit,false);path.value='';input.value='';form.elements.alt.value='';form.elements.alt.required=false;imagePreviewView(prefix,'');});
  return {
    get pending(){return pending;},
    reset(){sequence++;abort?.abort();pending=false;input.value='';busy(submit,false);if(prefix==='promotion')form.elements.alt.required=Boolean(path.value);imagePreviewView(prefix,path.value);},
  };
}
