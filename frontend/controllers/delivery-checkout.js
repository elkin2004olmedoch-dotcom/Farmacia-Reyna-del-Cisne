import {deliveries,deliveryQuote} from '../models/deliveries.js';
import {money} from '../views/common.js';

export function deliveryCheckout(form,onChange){
  const byId=id=>document.getElementById(id),select=byId('checkout-zone');
  let zones=[],position=null,failed=false,loading=false,locationRequest=0;
  const zone=()=>zones.find(item=>item.id===select.value);
  const mode=()=>form.elements.delivery.value;
  function match(){const selected=zone();return selected && form.elements.province.value===selected.provincia && form.elements.city.value.trim().toLocaleLowerCase('es')===selected.canton.toLocaleLowerCase('es');}
  function syncAddress(){const selected=zone();if(selected){form.elements.province.value=selected.provincia;form.elements.city.value=selected.canton;}onChange();}
  async function reload(){
    if(loading)return;loading=true;const previous=select.value;
    try{
      zones=await deliveries.zones();failed=false;select.replaceChildren();
      for(const item of zones){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.nombre} · ${item.tarifaCentavos==null?'Tarifa pendiente':money(item.tarifaCentavos)}`;select.append(option);}
      if(zones.some(item=>item.id===previous))select.value=previous;
      if(!zones.length){const option=document.createElement('option');option.value='';option.textContent='Sin cobertura habilitada';select.append(option);}
      syncAddress();
    }catch{failed=true;select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='No se pudo consultar la cobertura';select.append(option);onChange();}
    finally{loading=false;}
  }
  select.addEventListener('change',()=>{position=null;locationRequest++;byId('checkout-remove-location').hidden=true;byId('checkout-location-status').textContent='No se ha compartido tu ubicación.';syncAddress();});
  byId('checkout-refresh-zone').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await reload();}finally{button.disabled=false;}});
  for(const field of [form.elements.province,form.elements.city])field.addEventListener('change',onChange);
  byId('checkout-remove-location').addEventListener('click',()=>{position=null;locationRequest++;byId('checkout-remove-location').hidden=true;byId('checkout-location-status').textContent='Ubicación retirada. Se usará únicamente tu dirección escrita.';});
  byId('checkout-use-location').addEventListener('click',()=>{
    const status=byId('checkout-location-status'),button=byId('checkout-use-location');
    if(mode()!=='delivery' || !match()){status.textContent='Selecciona tu zona de entrega antes de compartir un punto.';return;}
    if(!navigator.geolocation){status.textContent='Este navegador no ofrece ubicación. Puedes continuar con tu dirección escrita.';return;}
    const id=++locationRequest;button.disabled=true;status.textContent='Solicitando permiso para usar tu posición como destino de esta entrega…';
    navigator.geolocation.getCurrentPosition(value=>{
      button.disabled=false;if(id!==locationRequest || mode()!=='delivery')return;
      const {latitude,longitude}=value.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){status.textContent='No se recibió una ubicación válida. Usa tu dirección escrita.';return;}
      position={latitudEntrega:Number(latitude.toFixed(5)),longitudEntrega:Number(longitude.toFixed(5)),consienteUbicacion:true};
      status.textContent=`Punto añadido (precisión aproximada: ${Math.round(value.coords.accuracy)} m). Comprueba que tu dirección escrita corresponde a este destino en Puerto Quito.`;byId('checkout-remove-location').hidden=false;
    },()=>{button.disabled=false;if(id===locationRequest)status.textContent='No se obtuvo permiso o señal de ubicación. Puedes continuar con tu dirección escrita.';},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
  return {
    ready:reload(),reload,
    values(){return mode()==='delivery'?{zonaEntregaId:zone()?.id,esperadoTarifaVersion:zone()?.version,...(position || {})}:{};},
    issues(){return mode()!=='delivery'?{}:!match()?{city:'La cobertura seleccionada corresponde a Puerto Quito. Revisa provincia y cantón.'}:deliveryQuote(0,'delivery',zone()).enabled?{}:{zonaEntregaId:failed?'No pudimos consultar la cobertura. Reintenta o elige retiro en farmacia.':'La tarifa de esta zona todavía no está definida. Elige retiro o consulta con la farmacia.'};},
    enabled(){return mode()!=='delivery' || Boolean(match() && deliveryQuote(0,'delivery',zone()).enabled);},
    render(productCents){
      const quote=deliveryQuote(productCents,mode(),zone());
      byId('checkout-shipping-fee').textContent=mode()==='pickup'?'Retiro sin costo':quote.enabled?money(quote.shipping):'Pendiente de configurar';
      byId('checkout-grand-total').textContent=quote.enabled?money(quote.total):'Por confirmar';
      byId('checkout-shipping-status').textContent=mode()==='pickup'?'El total de productos incluye los impuestos aplicables.':quote.enabled?'La tarifa de envío se incluye en este total. El servidor comprobará su vigencia al confirmar.':'La farmacia definirá la tarifa antes de habilitar la confirmación de entrega en esta zona.';
      select.required=mode()==='delivery';
    },
    reset(){position=null;locationRequest++;byId('checkout-remove-location').hidden=true;byId('checkout-location-status').textContent='No se ha compartido tu ubicación.';},
  };
}
