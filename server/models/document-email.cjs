'use strict';
const {createHash}=require('node:crypto');
const mail=require('./email-delivery.cjs');
const {orderReceiptView}=require('../../frontend/views/receipts.js');
const {AppError}=require('../middleware/errors.cjs');
const template=require('./email-template.cjs');
const money=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(value||0));
const attachment=(filename,content)=>({filename,content:Buffer.from(content,'utf8').toString('base64')});
const key=(kind,id,email)=>createHash('sha256').update(JSON.stringify([kind,id,email])).digest('hex');
const page=body=>`<!doctype html><html lang="es"><meta charset="utf-8"><title>Farmacia Reina del Cisne</title><style>body{font:14px/1.6 Arial;color:#30241f;margin:28px}h1,h2,h3{color:#981e36}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #e3dcd1;text-align:left}dt{font-weight:bold}dd{margin:0 0 8px}footer{margin-top:24px}img{max-width:190px}</style><body>${body}</body></html>`;
function createDocumentEmail({db=require('./db.cjs'),send=(...args)=>mail.sendMessage(...args)}={}){
  async function summary(order,config,title,intro){
    const origin=config.emailVerification.publicOrigin;
    const products=db.producto?.findMany?await db.producto.findMany({where:{id:{in:(order.detalles||[]).map(line=>line.productoId)}},select:{id:true,imagen:true}}):[];
    const rows=(order.detalles||[]).map(line=>{
      const reference=products.find(product=>product.id===line.productoId)?.imagen;
      const image=typeof reference==='string'&&/^assets\/(?:images|uploads)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/.test(reference)?require('./cloudimages.cjs').getPublicImageUrl(reference)||new URL(reference,origin+'/').href:null;
      return `<tr>${image?`<td style="width:64px;padding:14px 8px 14px 0;vertical-align:top"><img src="${template.escape(image)}" width="56" height="64" alt="${template.escape(line.nombreProducto)}" style="object-fit:contain"></td>`:''}<td style="padding:14px 4px;border-bottom:1px solid #e5ddd3"><strong>${template.escape(line.nombreProducto)}</strong><br><span style="color:#6c625a">Cantidad: ${template.escape(line.cantidad)}</span></td><td style="padding:14px 0;text-align:right;vertical-align:top;border-bottom:1px solid #e5ddd3;white-space:nowrap">${template.escape(money(line.totalLinea??Number(line.precioUnitario)*line.cantidad))}</td></tr>`;
    }).join('');
    return template.frame(origin,title,`<p>${template.escape(intro)}</p><p style="padding:16px 0;border-top:1px solid #e5ddd3;border-bottom:1px solid #e5ddd3">Pedido <strong>RC-${template.escape(order.id)}</strong></p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><p>Productos: ${template.escape(money(order.subtotalProductos??order.total))}<br>Envío: ${template.escape(money(Number(order.costoEnvioCentavos||0)/100))}<br><strong>Total del pedido: ${template.escape(money(order.total))}</strong></p>${template.button(new URL('/pedidos',origin).href,'Ver mi pedido')}`);
  }
  async function deliver(order,config,kind,build){
    if(!config?.emailVerification?.enabled)return {status:'disabled'};
    try{
      const user=await db.usuario.findUnique({where:{id:order.userId},select:{id:true,email:true,activo:true,emailVerifiedAt:true}});
      if(!user?.activo || !user.emailVerifiedAt)return {status:'verification_required'};
      const body=await build(user);
      await send({...body,to:[user.email]},config.emailVerification,key(kind,order.id,JSON.stringify([user.email,body])));
      return {status:'accepted'}; // Provider acceptance is not proof of inbox delivery.
    }catch{return {status:'unavailable'};} // The committed order/invoice must never roll back on email failure.
  }
  async function receipt(order,config){
    return deliver(order,config,'receipt',async()=>{
      const origin=config.emailVerification.publicOrigin;
      const sheet=orderReceiptView(order).replace('src="assets/images/logo-reina-del-cisne.png"',`src="${new URL('/assets/images/logo-reina-del-cisne.png',origin).href}"`);
      const title=order.estado==='entregado'?'Tu pedido fue entregado':'Recibimos tu pedido';
      const html=await summary(order,config,title,'Gracias por confiar en nosotros para tu cuidado. Adjuntamos el comprobante de tu pedido. No acredita un pago ni sustituye una factura autorizada por el SRI.');
      return {subject:title+' | Farmacia Reina del Cisne',text:'Adjuntamos el comprobante de tu pedido. No acredita un pago ni sustituye una factura autorizada por el SRI.',html,attachments:[attachment('comprobante-pedido.html',page(sheet))]};
    });
  }
  async function invoice(value,billing,config){
    if(value.estado!=='AUTORIZADA')return {status:'not_authorized'};
    if(!config?.emailVerification?.enabled)return {status:'disabled'};
    try{
      const order=await db.pedido.findUnique({where:{id:value.pedidoId},include:{detalles:true}});
      if(!order)return {status:'unavailable'};
      return await deliver(order,config,'invoice-'+value.id,async user=>{
        const actor={id:user.id,role:'user'},xml=await billing.download(value.id,actor),html=await billing.ride(value.id,actor);
        return {subject:'Tu factura | Farmacia Reina del Cisne',text:'Adjuntamos el XML autorizado y la representación imprimible de tu factura. Revisa el ambiente indicado en los documentos.',html:await summary(order,config,'Tu factura está disponible','Adjuntamos el XML autorizado y la representación imprimible. Revisa el ambiente indicado en los documentos.'),attachments:[attachment('factura.xml',xml.xml),attachment('factura.html',html)]};
      });
    }catch{return {status:'unavailable'};}
  }
  async function resend(id,actor,config,billing){
    const order=await db.pedido.findUnique({where:{id},include:{detalles:true}});
    if(!order || order.userId!==actor.id)throw new AppError(404,'NOT_FOUND','No se encontró el pedido.');
    if(billing){const value=await billing.forOrder(id,actor);if(value?.estado==='AUTORIZADA')return invoice(value,billing,config);}
    return receipt(order,config);
  }
  async function delivered(id,config){
    if(!config?.emailVerification?.enabled)return {status:'disabled'};
    try{const order=await db.pedido.findUnique({where:{id},include:{detalles:true}});if(!order||order.estado!=='entregado')return {status:'not_delivered'};return await receipt(order,config);}catch{return {status:'unavailable'};}
  }
  return {receipt,invoice,resend,delivered};
}
module.exports={createDocumentEmail};
