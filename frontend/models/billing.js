import {request,ApiError} from './api.js';
import {events} from './events.js';
export const billing={
  configuration:()=>request('/admin/facturacion/configuracion'),
  saveConfiguration:body=>request('/admin/facturacion/configuracion',{method:'PUT',body}),
  uploadCertificate:body=>request('/admin/facturacion/certificado',{method:'POST',body}),
  invoices:page=>request(`/admin/facturacion/facturas?page=${page || 1}&limit=20`),
  create:body=>request('/admin/facturacion/facturas',{method:'POST',body}),
  emit:(id,production)=>request(`/admin/facturacion/facturas/${encodeURIComponent(id)}/emitir`,{method:'POST',body:production?{confirmarEmisionProduccion:true}:{}}),
  own:pedidoId=>request(`/pedidos/${encodeURIComponent(pedidoId)}/factura`),
};
export async function downloadInvoice(id,kind,{customer=false}={}) {
  if(!['xml','ride'].includes(kind))throw new Error('Formato de factura inválido.');
  const token=sessionStorage.getItem('farmacia-mvc-token');
  const base=customer?'/facturacion/facturas/':'/admin/facturacion/facturas/';
  let response;
  try{response=await fetch(`/api${base}${encodeURIComponent(id)}/${kind}`,{headers:{Authorization:`Bearer ${token || ''}`},cache:'no-store'});}
  catch(_){throw new Error('No pudimos descargar el comprobante. Revisa tu conexión.');}
  if(!response.ok){if(response.status===401){sessionStorage.removeItem('farmacia-mvc-token');events.dispatchEvent(new Event('session:expired'));}let payload;try{payload=await response.json();}catch(_){}throw new ApiError(payload?.error?.message || 'No se pudo descargar el comprobante.',response.status);}
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`factura-${id}.${kind==='xml'?'xml':'html'}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
