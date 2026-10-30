const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {performance}=require('node:perf_hooks');
// Uses the existing test fixture: temporary SQLite/uploads; no production writes.
const root=path.resolve(__dirname,'..');
process.chdir(root);
process.env.IMAGE_STORAGE='local';
const {chromium}=require(path.join(root,'node_modules/@playwright/test'));
const label=process.argv[2]||'sample';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Use an alphanumeric measurement label.');
const {app,db,directory}=require(path.join(root,'tests/reto2/fixture.cjs'));
const server=app.listen(0,'127.0.0.1');
const round=n=>Math.round(n*100)/100;
(async()=>{
  await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const connectionStart=performance.now();await require('../server/diagnostics.cjs').connect(db);const connectMs=round(performance.now()-connectionStart);
  const queries=[];for(let i=0;i<5;i++){const t=performance.now();await db.$queryRaw`SELECT 1`;queries.push(round(performance.now()-t));}
  const api=[];
  for(const route of ['/api/productos?pageSize=100','/api/productos?pageSize=4','/api/promociones'])for(let sample=0;sample<3;sample++){
    const start=performance.now();const response=await fetch(base+route);const headersAt=performance.now();const body=await response.arrayBuffer();api.push({route,sample,status:response.status,ttfbMs:round(headersAt-start),totalMs:round(performance.now()-start),bytes:body.byteLength});
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const samples=[];
  try{
    for(const profile of ['local','10Mbps-40ms'])for(let sample=0;sample<3;sample++){
      const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const session=await context.newCDPSession(page);await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
      if(profile!=='local')await session.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1250000,uploadThroughput:625000});
      await page.addInitScript(()=>{globalThis.measuredLcp=null;new PerformanceObserver(list=>{for(const entry of list.getEntries())globalThis.measuredLcp={startTime:entry.startTime,size:entry.size,tag:entry.element?.tagName,url:entry.url};}).observe({type:'largest-contentful-paint',buffered:true});});
      await page.goto(base,{waitUntil:'load',timeout:60000});await page.locator('#featured-products article').first().waitFor();
      await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);await page.waitForLoadState('networkidle');
      const metrics=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];return {ttfbMs:nav.responseStart-nav.requestStart,htmlMs:nav.responseEnd-nav.startTime,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,lcp:globalThis.measuredLcp,loadMs:nav.loadEventEnd,resources:performance.getEntriesByType('resource').map(r=>({url:r.name.replace(location.origin,''),durationMs:r.duration,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize,initiator:r.initiatorType})),cards:document.querySelectorAll('#featured-products article').length};});
      samples.push({profile,sample,...metrics,errors});await context.close();
      console.log(JSON.stringify({profile,sample,ttfbMs:round(metrics.ttfbMs),fcpMs:round(metrics.fcpMs),lcpMs:round(metrics.lcp?.startTime),requests:metrics.resources.length,transferBytes:metrics.resources.reduce((s,r)=>s+r.transferBytes,0)}));
    }
  }finally{await browser.close();}
  const output=path.join(os.tmpdir(),'farmacia-performance-'+label+'.json');fs.writeFileSync(output,JSON.stringify({label,date:new Date().toISOString(),node:process.version,chrome:'installed channel chrome',database:'temporary SQLite seeded by fixture',network:'10 Mbps download / 5 Mbps upload / 40 ms latency for constrained profile; cache disabled; desktop 1440x1000',connectMs,select1Ms:queries,api,samples},null,2));console.log('RESULT '+output);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await new Promise(resolve=>server.close(resolve));await db.$disconnect();const temp=path.resolve(os.tmpdir());const target=path.resolve(directory);if(target.startsWith(temp+path.sep+'farmacia-reto2-'))fs.rmSync(target,{recursive:true,force:true});});
