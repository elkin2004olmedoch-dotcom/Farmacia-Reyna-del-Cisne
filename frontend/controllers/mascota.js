const ASSETS=new URL('../assets/mascotas/',import.meta.url);
const PEOPLE={farmi:'Farmi',boti:'Boti',goti:'Goti'};
const STORED_CHARACTER='farmacia-companion';
const STORED_MOTION='farmacia-motion';
function stored(key){try{return localStorage.getItem(key);}catch(_){return null;}}
function remember(key,value){try{localStorage.setItem(key,value);}catch(_){}}
function cartCount(){try{const mvc=JSON.parse(localStorage.getItem('farmacia-mvc-carrito')||'{}');const local=JSON.parse(localStorage.getItem('farmacia-reina-cart')||'{}');return [...Object.values(mvc),...Object.values(local?.items||{})].reduce((sum,value)=>sum+(Number.isInteger(value)&&value>0?value:0),0);}catch(_){return 0;}}
function pageContext(){const path=location.pathname.split('/').pop()||'index.html',page=document.body.dataset.page,section=location.hash.slice(1),map={'index.html':page==='home'?'home':'home','catalogo.html':'catalog','producto.html':'product','comparar.html':'compare','checkout.html':'checkout','cuenta.html':'account','pedidos.html':'orders','ayuda.html':'help'};if(path==='index.html'&&['servicios','promos','ubicacion','contacto','featured-title'].includes(section))return section==='promos'?'promotions':section==='ubicacion'||section==='contacto'?'contact':'home';return map[path]||({'home':'home','catalog':'catalog','product':'product','compare':'compare','checkout':'checkout','account':'account','orders':'orders','help':'help'}[page]||'home');}

/** A small, local store-navigation helper. Messages never leave this module. */
export async function mascotaController(){
  if(document.querySelector('farmacia-mascota'))return;
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('widget.css',ASSETS).href;
  const responsiveStyle=document.createElement('link');responsiveStyle.rel='stylesheet';responsiveStyle.href=new URL('widget-responsive.css',ASSETS).href;
  const host=document.createElement('farmacia-mascota');
  const root=host.attachShadow({mode:'open'});
  root.append(style,responsiveStyle);
  const template=document.createElement('template');
  template.innerHTML=`<div class="companion"><section class="panel" id="panel" aria-labelledby="title" hidden><header><div><span class="eyebrow">TU COMPAÑERO DE FARMACIA</span><h2 id="title">Goti te acompaña</h2><p>Ayuda para navegar y preparar tu compra</p></div><button class="close" id="close" aria-label="Cerrar ayuda" type="button">×</button></header><div class="preferences"><label>Compañero<select id="character"><option value="farmi">Farmi</option><option value="boti">Boti</option><option value="goti">Goti</option></select></label><button id="motion" type="button" aria-pressed="false">Pausar movimiento</button></div><div class="messages" id="messages" role="log" aria-label="Ayuda de la farmacia" aria-live="polite"></div><nav class="shortcuts" id="shortcuts" aria-label="Preguntas rápidas de esta sección"></nav><form id="form"><label for="input" class="sr-only">¿Qué necesitas?</label><input id="input" maxlength="180" autocomplete="off" placeholder="¿Qué necesitas?" required><button type="submit" aria-label="Enviar consulta">↑</button></form><p class="local-note">Guía local de la tienda · tus mensajes no se envían</p></section><div class="bubble" id="bubble" role="status" hidden></div><button class="avatar" id="avatar" type="button" aria-label="Haz saltar a Goti"><canvas id="canvas" width="192" height="208" aria-hidden="true"></canvas></button><button class="launcher" id="launcher" type="button" aria-expanded="false" aria-controls="panel"><span class="online" aria-hidden="true"></span><span id="launcher-label">¿Te ayudo?</span><span aria-hidden="true">↗</span></button></div>`;
  root.append(template.content.cloneNode(true));document.body.append(host);
  const find=selector=>root.querySelector(selector);
  const canvas=find('#canvas'),context=canvas.getContext('2d');
  const images=new Map();
  let selected=stored(STORED_CHARACTER)||'goti';if(!PEOPLE[selected])selected='goti';
  let paused=stored(STORED_MOTION)==='paused'||(stored(STORED_MOTION)===null && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let manifest=null,state='idle',frame=0,elapsed=0,remaining=Infinity,lastTime=0,offset=0;
  let replyTimer=null,bubbleTimer=null,refreshTimer=null,requestVersion=0;
  let lastCartCount=cartCount();
  const quickQuestions={
    home:[['¿Qué productos tienen?','productos'],['¿Cómo hago mi pedido?','carrito'],['¿Dónde queda la farmacia?','ubicacion']],
    catalog:[['Buscar un producto','productos'],['Ver cuidado personal','categoria:cuidado'],['Ver mamá y bebé','categoria:bebe'],['Comparar productos','comparar']],
    product:[['¿Qué información tiene este producto?','detalle'],['¿Cómo agrego al carrito?','agregar'],['¿Puedo comparar alternativas?','comparar']],
    promotions:[['¿Cómo aplican los descuentos?','promociones'],['Ver productos en oferta','productos'],['Consultar disponibilidad','whatsapp']],
    compare:[['¿Qué debo comparar?','comparar'],['Buscar otro producto','productos'],['Revisar mi carrito','carrito']],
    checkout:[['¿Cómo cambio cantidades?','cantidades'],['¿Cómo completo mi pedido?','pedido'],['Hablar con la farmacia','whatsapp']],
    account:[['¿Cómo creo mi cuenta?','registro'],['¿Para qué necesito una cuenta?','cuenta'],['Comprar sin cuenta','invitado']],
    orders:[['¿Cómo reviso el estado?','estado pedido'],['¿Necesitas ayuda con una entrega?','whatsapp'],['Volver al catálogo','productos']],
    help:[['¿Cuál es el horario?','horario'],['Contactar por WhatsApp','whatsapp'],['Buscar un producto','productos']],
    contact:[['¿Cuál es el horario?','horario'],['Abrir ubicación','ubicacion'],['Contactar por WhatsApp','whatsapp']],
  };
  let currentContext=pageContext();
  let currentSignature=pageContext();
  function productName(){return document.querySelector('#product-detail h1')?.textContent.trim()||document.querySelector('h1')?.textContent.trim()||'este producto';}
  function contextSignature(){const context=pageContext();return context==='product'?`${context}:${productName()}`:context;}
  function refreshQuickQuestions(){
    currentContext=pageContext();
    currentSignature=contextSignature();
    const options=[...(quickQuestions[currentContext]||quickQuestions.home)];
    if(currentContext==='product'&&document.querySelector('#product-detail h1'))options[0]=[`Info de ${productName().slice(0,25)}`,'detalle'];
    const nav=find('#shortcuts');nav.replaceChildren();
    for(const [label,intent] of options){const button=document.createElement('button');button.type='button';button.setAttribute('data-quick-question',intent);button.textContent=label;button.addEventListener('click',()=>runQuickQuestion(intent));nav.append(button);}
  }
  function runQuickQuestion(intent){
    if(intent.startsWith('categoria:')){location.href=`catalogo.html?category=${encodeURIComponent(intent.split(':')[1])}`;return;}
    if(intent==='agregar'){const target=document.querySelector('#detail-add-button, #detail-add-form, [data-add]');target?.scrollIntoView({behavior:'smooth',block:'center'});target?.focus();}
    if(intent==='carrito'){const target=document.querySelector('.shop-cart');target?.setAttribute('aria-label','Abrir mi carrito');}
    if(intent==='comparar'){document.querySelector('#compare-picks')?.scrollIntoView({behavior:'smooth',block:'center'});}
    const actions={productos:'Quiero buscar productos',carrito:'Quiero revisar mi carrito',horario:'¿Cuál es el horario?',ubicacion:'¿Dónde queda la farmacia?',comparar:'Quiero comparar productos',promociones:'¿Cómo funcionan las promociones?',agregar:'¿Cómo agrego este producto al carrito?',detalle:'¿Qué información tiene este producto?',cantidades:'¿Cómo cambio las cantidades de mi pedido?',pedido:'¿Cómo completo mi pedido?',registro:'¿Cómo creo una cuenta?',cuenta:'¿Para qué necesito una cuenta?',invitado:'¿Puedo comprar sin cuenta?','estado pedido':'¿Cómo reviso el estado de mis pedidos?',whatsapp:'Quiero contactar por WhatsApp'};
    send(actions[intent]||intent);
  }

  function image(src){if(!images.has(src)){const value=new Image();value.src=new URL(src,ASSETS).href;images.set(src,value);}return images.get(src);}
  function character(){return manifest?.characters.find(item=>item.id===selected);}
  function clip(){return character()?.states?.[state];}
  function setState(next,options={}){
    const nextClip=character()?.states?.[next];if(!nextClip)return false;
    state=next;frame=0;elapsed=0;
    remaining=options.loop||next==='idle'?Infinity:nextClip.durations.reduce((sum,value)=>sum+value,0)*(options.loops||2);
    host.dispatchEvent(new CustomEvent('mascota:state',{detail:{character:selected,state},bubbles:true}));
    return true;
  }
  function setCharacter(id){
    if(!PEOPLE[id])return false;selected=id;remember(STORED_CHARACTER,id);
    find('#character').value=id;find('#title').textContent=`${PEOPLE[id]} te acompaña`;
    find('#avatar').setAttribute('aria-label',`Haz saltar a ${PEOPLE[id]}`);
    image(`art/${id}-base.png`);state='idle';frame=0;elapsed=0;remaining=Infinity;
    setState('waving',{loops:1});
    host.dispatchEvent(new CustomEvent('mascota:character',{detail:{id,name:PEOPLE[id]},bubbles:true}));
    return true;
  }
  function setPaused(value){
    paused=Boolean(value);remember(STORED_MOTION,paused?'paused':'active');
    find('#motion').textContent=paused?'Activar movimiento':'Pausar movimiento';
    find('#motion').setAttribute('aria-pressed',String(paused));
  }
  function sayBubble(text){
    clearTimeout(bubbleTimer);find('#bubble').textContent=text;find('#bubble').hidden=false;
    bubbleTimer=setTimeout(()=>{find('#bubble').hidden=true;},4000);
  }
  function open(value){
    refreshQuickQuestions();
    find('#panel').hidden=!value;find('#launcher').setAttribute('aria-expanded',String(value));
    find('#launcher-label').textContent=value?'Cerrar ayuda':'¿Te ayudo?';
    if(value){find('#bubble').hidden=true;setState('waving',{loops:1});find('#input').focus();}
    else find('#launcher').focus();
  }
  function append(text,type='bot',actions=[]){
    const message=document.createElement('div');message.className=`message ${type}`;
    const paragraph=document.createElement('p');paragraph.textContent=text;message.append(paragraph);
    if(actions.length){const links=document.createElement('div');links.className='message-links';for(const action of actions){const link=document.createElement('a');link.textContent=action.label;link.href=action.href;if(action.external){link.target='_blank';link.rel='noopener noreferrer';}links.append(link);}message.append(links);}
    find('#messages').append(message);find('#messages').scrollTop=find('#messages').scrollHeight;return message;
  }
  const whatsapp={label:'Hablar con la farmacia ↗',href:'https://wa.me/593979275988',external:true};
  function answer(text){
    const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
    const context=pageContext();
    if(/informacion tiene este producto|info de |detalles del producto/.test(normalized)&&context==='product')return{state:'review',text:`${productName()}. ${document.querySelector('#product-detail .shop-lead')?.textContent.trim()||'Revisa su descripción y presentación en esta ficha.'} Confirma la disponibilidad con la farmacia.`,actions:[{label:'Ver ficha del producto',href:'#product-detail'},whatsapp]};
    if(/agrego.*carrito|añadir.*carrito/.test(normalized)&&context==='product')return{state:'review',text:'Elige la cantidad en esta ficha y pulsa «Añadir al carrito». Si el producto requiere receta, coordina la revisión con el farmacéutico.',actions:[{label:'Ir a cantidad y añadir',href:'#product-detail'},whatsapp]};
    if(/comparar|alternativas/.test(normalized)&&context==='product')return{state:'review',text:`Puedes comparar ${productName()} con otros productos: vuelve al catálogo, marca hasta cuatro opciones y abre Comparar.`,actions:[{label:'Ver productos similares',href:'catalogo.html'},{label:'Abrir comparación',href:'comparar.html'}]};
    if(/descuento|promocion|oferta/.test(normalized)&&context==='promotions')return{state:'review',text:'Las promociones vigentes aparecen en esta sección y el descuento se refleja en los productos participantes. Consulta disponibilidad y precio final con la farmacia.',actions:[{label:'Ver promociones',href:'#promos'},whatsapp]};
    if(/cambiar cantidades|cantidades/.test(normalized)&&context==='checkout')return{state:'review',text:'En cada producto del carrito usa + o − para ajustar unidades. El resumen y el total se actualizan antes de completar el pedido.',actions:[{label:'Ir al contenido del carrito',href:'#checkout-items'}]};
    if(/completo mi pedido|comprar sin cuenta|invitado|\bpedido\b/.test(normalized)&&context==='checkout')return{state:'review',text:'Revisa los productos y cantidades, continúa para completar los datos de entrega y coordina el pedido con la farmacia. Si hace falta, inicia sesión en este paso.',actions:[{label:'Revisar productos y cantidades',href:'#checkout-items'},{label:'Continuar con mi pedido',href:'#checkout-next'},whatsapp]};
    if(/completo mi pedido|pedido/.test(normalized)&&context==='checkout')return{state:'review',text:'Primero revisa las cantidades del carrito y pulsa «Continuar» para completar tus datos y coordinar el pedido con la farmacia.',actions:[{label:'Revisar productos y cantidades',href:'#checkout-items'},{label:'Continuar',href:'#checkout-next'},whatsapp]};
    if(/creo una cuenta|necesito una cuenta/.test(normalized)&&context==='account')return{state:'review',text:'La cuenta de esta tienda te permite conservar tus datos y revisar los pedidos vinculados. Pulsa «Crear cuenta» en esta pantalla para registrarte.',actions:[{label:'Crear cuenta',href:'#show-register'},{label:'Iniciar sesión',href:'#login-panel'}]};
    if(/revisar el estado|estado de mis pedidos/.test(normalized)&&context==='orders')return{state:'review',text:'En esta sección aparece el estado de tus pedidos cuando iniciaste sesión con la cuenta usada al comprarlos. Si necesitas coordinar la entrega, escribe a la farmacia.',actions:[{label:'Ver mis pedidos',href:'#orders-list'},whatsapp]};
    if(/categor|cuidado personal|mama y bebe/.test(normalized)&&context==='catalog')return{state:'review',text:'Puedes filtrar el catálogo por categoría y ordenar por precio. También puedes buscar por nombre o descripción.',actions:[{label:'Ir a filtros',href:'#contenido'}]};
    if(/dosis|sintoma|tratamiento|me duele|que (tomo|tomar)|embaraz|diagnostic/.test(normalized))return{state:'waiting',text:'Para orientación sobre síntomas, dosis o tratamientos, consulta al profesional de la farmacia. Puedo ayudarte a encontrar el catálogo y los datos de contacto.',actions:[whatsapp]};
    if(/horario|abren|cierran|hora/.test(normalized))return{state:'review',text:'La farmacia atiende de lunes a sábado, de 08:00 a 19:00. Puedes confirmar la atención por WhatsApp antes de visitarnos.',actions:[{label:'Ver ubicación',href:'index.html#ubicacion'},whatsapp]};
    if(/whatsapp|telefono|contact|ubicacion|direccion/.test(normalized))return{state:'waving',text:'Puedes escribir a la farmacia al +593 97 927 5988. Allí te ayudarán a confirmar disponibilidad, pago y entrega.',actions:[whatsapp,{label:'Ver ubicación',href:'index.html#ubicacion'}]};
    if(/mis pedidos|estado.{0,15}pedido|seguir.{0,15}pedido/.test(normalized))return{state:'review',text:'En Mis pedidos puedes revisar tus compras y seguir su estado. Inicia sesión con la cuenta con la que confirmaste el pedido.',actions:[{label:'Ver mis pedidos',href:'pedidos.html'},{label:'Ir a mi cuenta',href:'cuenta.html'}]};
    if(/carrito|pedido|pagar|pago|entrega|comprar/.test(normalized))return{state:'review',text:'Añade los productos al carrito, revisa las cantidades e inicia sesión para confirmar tu pedido. El pago y la entrega se coordinan directamente con la farmacia.',actions:[{label:'Revisar mi carrito',href:'checkout.html'},{label:'Ver mis pedidos',href:'pedidos.html'},whatsapp]};
    if(/^(hola|buenas|gracias|ayuda|productos)[!.? ]*$/.test(normalized))return{state:'waving',text:`¡Hola! Soy ${PEOPLE[selected]}. Puedo guiarte al catálogo, a tu carrito, a tus pedidos o al horario de la farmacia. ¿Qué producto buscas?`,actions:[{label:'Ver catálogo',href:'catalogo.html'},{label:'Mi carrito',href:'checkout.html'}]};
    const query=text.replace(/^(hola[, ]*)?(quiero |necesito |puedes |por favor )*(buscar |busca |encontrar |un producto[: ]*|producto[: ]*)/i,'').trim().slice(0,100)||text.slice(0,100);
    return{state:'waiting',text:`Puedes buscar «${query}» en el catálogo. Allí verás las presentaciones y los precios publicados. Confirma con la farmacia cualquier duda de disponibilidad o receta.`,actions:[{label:`Buscar ${query}`,href:`catalogo.html?q=${encodeURIComponent(query)}`},whatsapp]};
  }
  function send(text){
    const message=String(text||'').trim().slice(0,180);if(!message)return;
    clearTimeout(replyTimer);requestVersion+=1;const version=requestVersion;
    root.querySelectorAll('.message.thinking').forEach(node=>node.remove());
    append(message,'user');find('#input').value='';
    const pending=append(`${PEOPLE[selected]} está pensando…`,'thinking');
    setState('running',{loop:true});
    replyTimer=setTimeout(()=>{
      if(version!==requestVersion)return;pending.remove();const response=answer(message);append(response.text,'bot',response.actions);
      if(!setState(response.state))setState('idle');
    },1000);
  }
  async function loadManifest(){
    try{
      const response=await fetch(new URL('sprites/manifest.json',ASSETS),{cache:'no-cache'});
      if(!response.ok)return;const next=await response.json();if(next.schema!=='farmacia-companions-1')return;
      manifest=next;for(const item of next.characters){item.imagePath=`${item.atlas}?v=${item.atlasSha256||next.generatedAt}`;image(item.imagePath);}
      if(next.complete && refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
      if(!clip())setState('idle');
    }catch(_){/* Store navigation remains usable if sprite resources are unavailable. */}
  }
  function tick(time){
    const delta=lastTime?Math.min(time-lastTime,80):0;lastTime=time;
    const current=clip();
    if(!paused && !document.hidden && current){
      elapsed+=delta;while(elapsed>=current.durations[frame]){elapsed-=current.durations[frame];frame=(frame+1)%current.frames.length;}
      if(Number.isFinite(remaining)){remaining-=delta;if(remaining<=0){offset=0;setState('idle');}}
    }
    context.clearRect(0,0,192,208);context.imageSmoothingEnabled=false;
    const currentFrame=clip(),atlas=character()?.imagePath?image(character().imagePath):null;
    if(currentFrame && atlas?.complete && atlas.naturalWidth){const rect=currentFrame.frames[Math.min(frame,currentFrame.frames.length-1)];context.drawImage(atlas,rect.x,rect.y,rect.width,rect.height,8+offset,17.333,176,190.667);}
    else{const base=image(`art/${selected}-base.png`);if(base.complete && base.naturalWidth){const scale=Math.min(180/base.naturalWidth,196/base.naturalHeight);const w=base.naturalWidth*scale,h=base.naturalHeight*scale;context.drawImage(base,(192-w)/2,208-h,w,h);}}
    requestAnimationFrame(tick);
  }
  find('#launcher').addEventListener('click',()=>open(find('#panel').hidden));
  find('#close').addEventListener('click',()=>open(false));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!find('#panel').hidden){event.preventDefault();open(false);}});
  find('#avatar').addEventListener('click',()=>{setState('jumping',{loops:1});sayBubble('¡Aquí estoy! Pulsa «¿Te ayudo?» para conversar.');});
  find('#avatar').addEventListener('pointerenter',()=>{if(state==='idle')setState('waving',{loops:1});});
  find('#avatar').addEventListener('pointermove',event=>{if(paused || state==='jumping')return;const box=canvas.getBoundingClientRect();offset=Math.max(-8,Math.min(8,(event.clientX-box.left-box.width/2)/4));if(Math.abs(offset)>5 && state==='idle')setState(offset>0?'running-right':'running-left',{loops:1});});
  find('#avatar').addEventListener('pointerleave',()=>{offset=0;});
  find('#character').addEventListener('change',event=>setCharacter(event.target.value));
  find('#motion').addEventListener('click',()=>setPaused(!paused));
  find('#form').addEventListener('submit',event=>{event.preventDefault();send(find('#input').value);});
  refreshQuickQuestions();
  const questionObserver=new MutationObserver(()=>{const next=contextSignature();if(next!==currentSignature||find('#shortcuts').children.length===0)refreshQuickQuestions();});
  questionObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
  window.addEventListener('hashchange',refreshQuickQuestions);
  window.addEventListener('farmacia:cart',()=>{
    const count=cartCount();
    if(count>lastCartCount){setState('jumping',{loops:1});sayBubble('¡Producto añadido! Puedes revisarlo en tu carrito.');}
    else if(count!==lastCartCount)setState('review',{loops:1});
    lastCartCount=count;
  });
  setCharacter(selected);setPaused(paused);
  append(`¡Hola! Soy ${PEOPLE[selected]}. Te ayudo a encontrar productos y a preparar tu compra. Elige una opción o escribe el nombre de un producto.`, 'bot',[{label:'Explorar catálogo',href:'catalogo.html'}]);
  await loadManifest();refreshTimer=manifest?.complete?null:setInterval(loadManifest,15000);
  requestAnimationFrame(tick);
  globalThis.FarmaciaMascota=Object.freeze({setCharacter,setState,setPaused,open,sendMessage:send,getStatus:()=>({character:selected,state,frame,paused,open:!find('#panel').hidden,availableStates:Object.keys(character()?.states||{})})});
}
