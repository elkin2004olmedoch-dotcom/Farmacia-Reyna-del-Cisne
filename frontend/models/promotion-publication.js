export function promotionPublication(campaign,now=Date.now()){
  const percentage=Number(campaign.descuentoPorcentaje || 0);
  const instant=new Date(now).getTime();
  const scheduled=Boolean(campaign.inicio && new Date(campaign.inicio).getTime()>instant);
  const expired=Boolean(campaign.fin && new Date(campaign.fin).getTime()<=instant);
  const flags={percentage,scheduled,expired};
  if(!campaign.activa)return {...flags,kind:'unpublished',label:'No publicada',message:'La campaña está guardada sin publicar y no aplica descuento.'};
  if(campaign.vistaPrevia){
    const visibility=expired?'La campaña está en vista previa y su vigencia terminó.':scheduled?'La campaña está en vista previa y sólo se mostrará al iniciar su vigencia.':'La campaña se muestra como vista previa.';
    const next=expired?'Ajusta la fecha de fin para publicarla.':percentage>0?'Usa «Publicar descuento» para aplicarlo durante su vigencia.':'Configura un descuento mayor que 0 % para publicarlo.';
    return {...flags,kind:'preview',label:'Vista previa · sin descuento',message:`${visibility} No aplica descuento al producto, carrito ni pedido. ${next}`};
  }
  if(expired)return {...flags,kind:'expired',label:'Finalizada · sin descuento',message:'La vigencia terminó. Esta campaña ya no aplica descuentos. Ajusta la fecha de fin para volver a publicarla.'};
  if(scheduled)return {...flags,kind:'scheduled',label:'Programada',message:`La campaña está publicada y comenzará en la fecha de inicio indicada, en hora de Ecuador. ${percentage>0?'Hasta entonces no aplica el '+percentage+' % de descuento.':'No tiene descuento configurado.'}`};
  if(percentage<=0)return {...flags,kind:'published',label:'Publicada · sin descuento',message:'La campaña está publicada sin descuento. El precio del producto conserva el descuento directo que tenga configurado.'};
  return {...flags,kind:'discount',label:`Publicada · descuento ${percentage} %`,message:`El ${percentage} % está publicado y vigente: se aplica al producto, carrito y nuevos pedidos. Si existe otro descuento mayor, se aplica el mayor; no se suman.`};
}
