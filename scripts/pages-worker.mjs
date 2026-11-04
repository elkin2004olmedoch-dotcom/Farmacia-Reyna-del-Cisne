// Fixed upstream, generated at build time. No proxy destination comes from the browser.
const upstream='https://farmacia-reina-del-cisne.onrender.com';
const allowedHeaders=['Accept','Content-Type','Authorization','X-Farmacia-Web','Origin'];
const cookies=new Set(['__Host-farmacia-access','__Host-farmacia-refresh']);
if(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(upstream))for(const name of ['farmacia-access','farmacia-refresh'])cookies.add(name);
export function createProxy(send=fetch){return async(request,env)=>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 const error=(status,message)=>Response.json({ok:false,error:{message}},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!['GET','HEAD','POST','PUT','DELETE','OPTIONS'].includes(request.method))return error(405,'Método no permitido.');
 const origin=request.headers.get('Origin');
 if(origin&&origin!==url.origin)return error(403,'Origen no autorizado.');
 if(url.pathname.includes('\\')||/%(?:2f|5c|2e)/i.test(url.pathname))return error(400,'Ruta inválida.');
 const headers=new Headers();for(const name of allowedHeaders){const value=request.headers.get(name);if(value)headers.set(name,value);}
 const own=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>cookies.has(v.split('=')[0]));
 if(own.length)headers.set('Cookie',own.join('; '));
 try{
  const response=await send(upstream+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(65000),duplex:'half',cache:'no-store'});
  if(response.status>=300&&response.status<400)return error(502,'No se pudo completar la solicitud.');
  if([429,502,503,504].includes(response.status)&&!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('Content-Type')||'')){
   await response.body?.cancel();
   return error(response.status,response.status===429?'El servicio está temporalmente limitado. Espera un momento y vuelve a intentar.':'La farmacia está tardando en responder. Intenta nuevamente.');
  }
  const output=new Headers(response.headers);output.set('Cache-Control','no-store');
  for(const name of ['Content-Length','Access-Control-Allow-Origin','Access-Control-Allow-Credentials'])output.delete(name);
  return new Response(response.body,{status:response.status,headers:output});
 }catch{return error(503,'La farmacia está tardando en responder. Intenta nuevamente.');}
};}
export default {fetch:createProxy()};
