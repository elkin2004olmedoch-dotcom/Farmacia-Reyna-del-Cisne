'use strict';
// Reproducible laboratory measurements; no credentials or commercial writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{performance}=require('node:perf_hooks');
const {chromium}=require('@playwright/test');
const {trackNetwork,settleNetwork}=require('./browser-network.cjs');
const root=path.resolve(__dirname,'..');process.chdir(root);
const args=process.argv.slice(2),label=args.shift()||'sample';
if(!/^[a-z0-9-]{1,50}$/.test(label))throw new Error('Etiqueta inválida.');
let frontendRoot=path.join(root,'frontend'),publicOrigin=null,sampleCount=3;
for(let i=0;i<args.length;i++){
 if(args[i]==='--frontend-root')frontendRoot=path.resolve(args[++i]);
 else if(args[i]==='--public')publicOrigin='https://farmacia-reyna-del-cisne-pruebas.pages.dev';
 else if(args[i]==='--samples')sampleCount=Number(args[++i]);
 else throw new Error('Argumento inválido.');
}
if(!Number.isInteger(sampleCount)||sampleCount<1||sampleCount>5)throw new Error('Usa entre una y cinco muestras.');
const round=n=>Number.isFinite(n)?Math.round(n*100)/100:null;
async function measure(origin){
 const catalogResponse=await fetch(origin+'/api/productos?pageSize=24',{signal:AbortSignal.timeout(55000)}),catalog=(await catalogResponse.json()).data;
 if(!catalogResponse.ok||!catalog.items?.length)throw new Error('Catálogo no disponible.');
 const product=catalog.items.find(item=>/pigeon/i.test(item.nombre))||catalog.items[0];
 const browser=await chromium.launch({channel:'chrome',headless:true}),samples=[],api=[];
 try{
  for(const route of ['/api/productos?pageSize=24','/api/productos/sugerencias?q=eucerin','/api/productos/filtros']){
   const started=performance.now(),response=await fetch(origin+route,{signal:AbortSignal.timeout(55000)}),headersAt=performance.now(),body=await response.arrayBuffer();api.push({route,status:response.status,ttfbMs:round(headersAt-started),totalMs:round(performance.now()-started),bytes:body.byteLength});
  }
  for(const [device,viewport,cpu,latency,download]of [['escritorio',{width:1440,height:1000},1,0,-1],['movil-4g',{width:390,height:844},4,80,1250000]]){
   for(const route of ['/','/catalogo.html','/producto.html?id='+encodeURIComponent(product.id)])for(let sample=0;sample<sampleCount;sample++){
    const context=await browser.newContext({viewport,deviceScaleFactor:device==='escritorio'?1:2,isMobile:device!=='escritorio',hasTouch:device!=='escritorio',serviceWorkers:'block'}),page=await context.newPage(),errors=[],failed=[];
    trackNetwork(page);
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const pathname=new URL(r.url()).pathname;if(r.status()>=400&&!(r.status()===401&&pathname==='/api/auth/me'))failed.push({path:pathname,status:r.status()});});
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
    if(latency)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency,downloadThroughput:download,uploadThroughput:625000});
    await page.addInitScript(()=>{
     globalThis.labMetrics={lcp:null,shifts:[],interactions:[]};
     const watch=(type,callback,extra={})=>{try{new PerformanceObserver(list=>list.getEntries().forEach(callback)).observe({type,buffered:true,...extra});}catch{}};
     watch('largest-contentful-paint',entry=>{labMetrics.lcp=entry.startTime;});
     watch('layout-shift',entry=>{if(!entry.hadRecentInput)labMetrics.shifts.push({time:entry.startTime,value:entry.value,sources:(entry.sources||[]).map(item=>({node:item.node?.id||item.node?.className||item.node?.tagName,previous:item.previousRect.toJSON(),current:item.currentRect.toJSON()}))});});
     watch('event',entry=>{if(entry.interactionId)labMetrics.interactions.push({id:entry.interactionId,duration:entry.duration});},{durationThreshold:16});
    });
    await page.goto(origin+route,{waitUntil:'load',timeout:60000});
    await page.locator(route==='/'?'#featured-products article':route.startsWith('/catalogo')?'#catalog-grid article':'#product-detail h1').first().waitFor({timeout:30000});
    await settleNetwork(page,{timeout:30000});
    const lcpBeforeInteraction=await page.evaluate(()=>labMetrics.lcp);
    if(route.startsWith('/catalogo')){await page.locator('#catalog-search').fill('Eucerin');await page.locator('#catalog-grid article').first().waitFor();await page.locator('#catalog-search').press('Escape');}
    else if(route.startsWith('/producto')){const button=page.locator('#zoom-product');if(await button.count()){await button.click();await page.keyboard.press('Escape');}}
    else {const button=page.locator('#menu-button');if(await button.isVisible()){await button.click();await button.click();}}
    await page.waitForTimeout(250);
    const metrics=await page.evaluate(()=>{
     const nav=performance.getEntriesByType('navigation')[0];let cls=0,value=0,start=0,last=0;
     for(const shift of labMetrics.shifts){if(shift.time-last>1000||shift.time-start>5000){value=0;start=shift.time;}value+=shift.value;last=shift.time;cls=Math.max(cls,value);}
     return {ttfbMs:nav.responseStart-nav.requestStart,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,cls,shifts:labMetrics.shifts,interactionMaxMs:labMetrics.interactions.length?Math.max(...labMetrics.interactions.map(item=>item.duration)):null,interactionCount:new Set(labMetrics.interactions.map(item=>item.id)).size,resources:performance.getEntriesByType('resource').map(item=>({path:new URL(item.name,location.href).pathname,bytes:item.transferSize,durationMs:item.duration})),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    const row={device,route,sample,cpuThrottle:cpu,network:latency?'10Mbps down/5Mbps up, 80ms':'sin limitación',ttfbMs:round(metrics.ttfbMs),fcpMs:round(metrics.fcpMs),lcpBeforeInteractionMs:round(lcpBeforeInteraction),cls:metrics.cls,shifts:metrics.shifts,interactionMaxMs:metrics.interactionMaxMs,interactionCount:metrics.interactionCount,requests:metrics.resources.length,transferBytes:metrics.resources.reduce((sum,item)=>sum+item.bytes,0),resources:metrics.resources,overflow:metrics.overflow,errors,failed};samples.push(row);console.log(JSON.stringify({...row,resources:undefined,shifts:undefined}));await context.close();
   }
  }
 }finally{await browser.close();}
 return {label,at:new Date().toISOString(),origin,source:publicOrigin?'público, sin cuentas ni pedidos':'API y SQLite temporales',frontendRoot:publicOrigin?undefined:frontendRoot,method:'Chrome instalado; caché y service worker deshabilitados; móvil emulado 390x844, CPU4x y red limitada; LCP previo a interacción, CLS ventana, duración máxima observada de interacciones de laboratorio (no INP de campo). No son percentiles de usuarios reales.',api,samples};
}
(async()=>{
 let server,db,origin=publicOrigin;
 try{
  if(!origin){process.env.IMAGE_STORAGE='local';({db}=require('../tests/reto2/fixture.cjs'));const settings=require('../server/config.cjs')();const app=require('../server/app.cjs')({...settings,frontendRoot});server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;settings.origins.push(origin);}
  const report=await measure(origin),output=path.join(os.tmpdir(),'farmacia-experiencia-rendimiento-'+label+'.json');fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('RESULT '+output);if(report.samples.some(row=>row.errors.length||row.failed.length||row.overflow))throw new Error('La medición encontró errores o desbordamiento.');
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.$disconnect();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
