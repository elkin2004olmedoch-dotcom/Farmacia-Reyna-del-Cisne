'use strict';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const brand='Farmacia Reina del Cisne';
function frame(origin,title,body){
 const logo=new URL('/assets/images/logo-reina-del-cisne.png',origin).href;
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | ${brand}</title></head><body style="margin:0;background:#f8f4eb;color:#30241f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fffefa;border:1px solid #e5ddd3;border-radius:20px"><tr><td style="padding:32px 24px;font-size:17px;line-height:1.7"><img src="${escape(logo)}" width="190" height="64" alt="${brand}" style="display:block;max-width:100%;height:auto;margin-bottom:30px"><h1 style="font-size:29px;line-height:1.25;margin:0 0 20px;color:#702137">${escape(title)}</h1>${body}<p style="margin-top:30px;font-size:13px;color:#6c625a;border-top:1px solid #e5ddd3;padding-top:16px">${brand} · Puerto Quito, Ecuador</p></td></tr></table></td></tr></table></body></html>`;
}
function button(href,label){return `<p style="margin:28px 0"><a href="${escape(href)}" style="display:inline-block;border-radius:40px;background:#981e36;color:#fff;padding:14px 28px;text-decoration:none;font-weight:bold">${escape(label)}</a></p>`;}
module.exports={escape,frame,button};
