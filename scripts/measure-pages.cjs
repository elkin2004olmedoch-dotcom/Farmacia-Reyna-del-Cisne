const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {performance}=require('node:perf_hooks');
const {createHash,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
function argumentsFor(args){
  const options={label:'sample',baselineRoot:null,activeSamples:3,scenarios:['active','cold','offline'],profiles:['local','10Mbps-40ms'],diagnostics:false,trace:false,directLoopback:false};let labelled=false;
  for(let index=0;index<args.length;index++){
    const arg=args[index];
    if(arg==='--baseline-root')options.baselineRoot=args[++index];
    else if(arg==='--active-samples')options.activeSamples=Number(args[++index]);
    else if(arg==='--scenarios')options.scenarios=(args[++index] || '').split(',');
    else if(arg==='--profiles')options.profiles=(args[++index] || '').split(',');
    else if(arg==='--diagnostics')options.diagnostics=true;
    else if(arg==='--trace'){options.trace=true;options.diagnostics=true;}
    else if(arg==='--direct-loopback')options.directLoopback=true;
    else if(!labelled && /^[a-z0-9-]{1,40}$/.test(arg)){options.label=arg;labelled=true;}
    else throw new Error('Invalid measurement arguments.');
  }
  if(!options.baselineRoot || !Number.isInteger(options.activeSamples) || options.activeSamples<1 || options.activeSamples>3 || !options.scenarios.length || options.scenarios.some(value=>!['active','cold','offline'].includes(value)) || !options.profiles.length || options.profiles.some(value=>!['local','10Mbps-40ms'].includes(value)))throw new Error('Invalid measurement arguments.');
  options.baselineRoot=path.resolve(options.baselineRoot);return options;
}
const round=value=>Number.isFinite(value)?Math.round(value*100)/100:null;
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

// Freeze public baseline files before measuring. Private uploads and links are excluded.
function snapshot(source,destination){
  const manifest=[];
  function copy(directory=''){
    for(const entry of fs.readdirSync(path.join(source,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name==='uploads')continue;
      const relative=directory?directory+'/'+entry.name:entry.name;
      if(entry.isDirectory()){copy(relative);continue;}
      if(!/\.(?:html|m?js|css|json|png|jpg|jpeg|webp|svg|ttf|woff2?)$/.test(entry.name))continue;
      const bytes=fs.readFileSync(path.join(source,relative));
      const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
      manifest.push({path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
  copy();
  if(!fs.existsSync(path.join(destination,'index.html')) || !fs.existsSync(path.join(destination,'controllers/app.js')))throw new Error('Baseline must be the MVC frontend directory.');
  return {capturedAt:new Date().toISOString(),root:source,files:manifest.length,sha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),manifest,
    reproduction:'This is the source version present before synchronization, frozen for this run. After the source changes, restore the baseline ZIP separately and pass its frontend directory with --baseline-root.'};
}
function applyHeaders(file){
  // build-pages currently emits one global block. Reject a changed format instead of ignoring CSP.
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(line=>line.trim() && !line.trimStart().startsWith('#'));
  if(lines.shift()!=='/*')throw new Error('Expected global Pages headers.');
  const headers=lines.map(line=>{const match=line.match(/^\s+([^:]+):\s*(.*)$/);if(!match)throw new Error('Unexpected Pages headers.');return [match[1],match[2]];});
  return (req,res,next)=>{for(const [name,value] of headers)res.setHeader(name,value);next();};
}
async function listen(server){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return 'http://127.0.0.1:'+server.address().port;}
async function close(server){if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}

async function measure(options){
  process.chdir(root);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-measure-'));
  const baselineRoot=path.join(directory,'baseline'),output=path.join(directory,'public');
  let db,browser,apiServer,staticServer;const timers=new Set();let mode={name:'active',readyAt:0};
  try{
    const baseline=snapshot(options.baselineRoot,baselineRoot);
    Object.assign(process.env,{NODE_ENV:'test',IMAGE_STORAGE:'local',PERF_DIAGNOSTICS:'0',
      DATABASE_URL:'file:'+path.join(directory,'measure.db').replaceAll('\\','/'),UPLOAD_DIR:path.join(directory,'uploads'),
      JWT_SECRET:randomBytes(48).toString('hex'),ADMIN_EMAIL:'admin-measure@example.ec',ADMIN_PASSWORD:'AdminMeasure2026!',CORS_ORIGIN:'http://127.0.0.1'});
    for(const args of [['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma'],['server/prisma/seed.cjs']])execFileSync(process.execPath,args,{env:process.env,stdio:'pipe'});
    let app;
    apiServer=http.createServer((req,res)=>{
      if(mode.name==='offline')return; // Accept HTTP, but deliberately send no headers or body.
      const remaining=mode.name==='cold'?mode.readyAt-performance.now():0;
      if(remaining>0){
        const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)app(req,res);},remaining);timers.add(timer);
        res.once('close',()=>{clearTimeout(timer);timers.delete(timer);});return;
      }
      if(app)app(req,res);else res.writeHead(503).end();
    });
    const apiOrigin=await listen(apiServer);
    const express=require('express'),staticApp=express();staticApp.disable('x-powered-by');
    staticServer=http.createServer(staticApp);const staticOrigin=await listen(staticServer);
    process.env.CORS_ORIGIN=staticOrigin+','+apiOrigin;
    const settings={...require('../server/config.cjs')(),frontendRoot:baselineRoot,testAuthLimit:200,testApiLimit:2000};
    db=require('../server/models/db.cjs');app=require('../server/app.cjs')(settings);
    const connectStart=performance.now();await db.$connect();const connectMs=round(performance.now()-connectStart);
    const artifact=require('./build-pages.cjs').buildPages({output,apiOrigin,allowLocal:true});
    staticApp.use(applyHeaders(path.join(output,'_headers')));
    staticApp.use((req,res,next)=>{if(/^\/api(?:\/|$)/.test(req.path) || /^\/assets\/uploads(?:\/|$)/.test(req.path) || ['/_headers','/_redirects'].includes(req.path))return res.sendStatus(404);next();});
    staticApp.use(express.static(output,{dotfiles:'deny',extensions:['html'],redirect:false,maxAge:0}));staticApp.use((req,res)=>res.sendStatus(404));
    if(options.directLoopback && [apiOrigin,staticOrigin].some(origin=>new URL(origin).hostname!=='127.0.0.1'))throw new Error('Direct mode is restricted to the harness loopback listeners.');
    const traceDirectory=options.trace?fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-traces-')):null;
    const {chromium}=require('@playwright/test');browser=await chromium.launch({channel:'chrome',headless:true,...(options.directLoopback?{args:['--no-proxy-server']}:{})});
    const samples=[];
    async function sample(variant,scenario,profile,index){
      const base=variant==='coupled'?apiOrigin:staticOrigin;
      const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
      const page=await context.newPage(),requests=new Map(),pageErrors=[],navigationErrors=[],traceEvents=[];let blockedThirdParty=0,documentReceived=false,documentNetwork=null;
      const allowed=new Set([apiOrigin,staticOrigin]);
      const describeUrl=value=>{try{const url=new URL(value,base);return allowed.has(url.origin)?{origin:url.origin===apiOrigin?'api':'static',path:url.pathname}:{origin:'blocked',path:null};}catch(_){return {origin:'unknown',path:null};}};
      await context.route('**/*',route=>{if(allowed.has(new URL(route.request().url()).origin))return route.continue();blockedThirdParty++;return route.abort();});
      page.on('pageerror',error=>pageErrors.push(error.name || 'Error'));
      const session=await context.newCDPSession(page);await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
      if(options.trace){
        session.on('Tracing.dataCollected',event=>traceEvents.push(...event.value));
        await session.send('Tracing.start',{categories:'devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack,disabled-by-default-devtools.screenshot',options:'record-as-much-as-possible',transferMode:'ReportEvents'});
      }
      if(profile==='10Mbps-40ms')await session.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1250000,uploadThroughput:625000});
      session.on('Network.requestWillBeSent',event=>{
        if(!allowed.has(new URL(event.request.url).origin))return;
        requests.set(event.requestId,{type:event.type,bytes:0,complete:false,...(options.diagnostics?{...describeUrl(event.request.url),startTimestamp:event.timestamp,priority:event.request.initialPriority,initiator:event.initiator.type}:{})});
        if(event.type==='Document' && event.request.url===base+'/')documentNetwork={startTimestamp:event.timestamp};
      });
      session.on('Network.resourceChangedPriority',event=>{const request=requests.get(event.requestId);if(options.diagnostics && request)request.priority=event.newPriority;});
      session.on('Network.responseReceived',event=>{
        if(event.type==='Document' && event.response.url===base+'/'){
          documentReceived=true;documentNetwork={...documentNetwork,responseTimestamp:event.timestamp,timing:event.response.timing || null};
        }
        const request=requests.get(event.requestId);if(options.diagnostics && request)Object.assign(request,{responseTimestamp:event.timestamp,status:event.response.status,timing:event.response.timing || null});
      });
      session.on('Network.loadingFinished',event=>{const request=requests.get(event.requestId);if(request){request.bytes=event.encodedDataLength;request.complete=true;if(options.diagnostics)request.endTimestamp=event.timestamp;}});
      session.on('Network.loadingFailed',event=>{const request=requests.get(event.requestId);if(request){request.complete=true;request.error=/^net::ERR_[A-Z_]+$/.test(event.errorText)?event.errorText:'NETWORK_FAILED';if(options.diagnostics)request.endTimestamp=event.timestamp;}});
      await page.addInitScript(({diagnostics})=>{
        if(window!==window.top)return;
        globalThis.pagesMeasurement={lcp:null,productsReadyMs:null,menuReadyMs:null,lcpCandidates:diagnostics?[]:null,longTasks:diagnostics?[]:null,fontEvents:diagnostics?[]:null};
        new PerformanceObserver(list=>{for(const entry of list.getEntries()){
          const candidate={startTime:entry.startTime,renderTime:entry.renderTime,loadTime:entry.loadTime,size:entry.size,tag:entry.element?.tagName || null,urlPath:entry.url?new URL(entry.url,location.href).pathname:null,element:{id:entry.element?.id || null,className:entry.element?.className || null}};
          globalThis.pagesMeasurement.lcp=candidate;if(diagnostics)globalThis.pagesMeasurement.lcpCandidates.push(candidate);
        }}).observe({type:'largest-contentful-paint',buffered:true});
        if(diagnostics){
          new PerformanceObserver(list=>{for(const entry of list.getEntries())globalThis.pagesMeasurement.longTasks.push({startTime:entry.startTime,duration:entry.duration,name:entry.name});}).observe({type:'longtask',buffered:true});
          for(const name of ['loading','loadingdone','loadingerror'])document.fonts.addEventListener(name,event=>globalThis.pagesMeasurement.fontEvents.push({event:name,startTime:performance.now(),faces:event.fontfaces?.map(font=>({family:font.family,weight:font.weight,status:font.status})) || []}));
        }
        const inspect=()=>{
          const metrics=globalThis.pagesMeasurement;
          if(metrics.menuReadyMs===null && document.body?.hasAttribute('data-session-role'))metrics.menuReadyMs=performance.now();
          if(metrics.productsReadyMs===null && document.querySelectorAll('#featured-products article').length>=4)metrics.productsReadyMs=performance.now();
        };
        new MutationObserver(inspect).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-session-role']});inspect();
      },{diagnostics:options.diagnostics});
      const windowMs=scenario==='cold'?35000:scenario==='offline'?25000:20000;
      const started=performance.now();mode={name:scenario,readyAt:started+30000};
      let navigation;
      try{
        navigation=page.goto(base+'/',{waitUntil:'load',timeout:windowMs}).catch(error=>{navigationErrors.push(error.name==='TimeoutError'?'NAVIGATION_TIMEOUT':'NAVIGATION_FAILED');});
        if(scenario==='active'){
          await navigation;
          try{await page.waitForFunction(()=>globalThis.pagesMeasurement && globalThis.pagesMeasurement.productsReadyMs!==null && globalThis.pagesMeasurement.menuReadyMs!==null,{},{timeout:20000});await page.waitForLoadState('networkidle',{timeout:20000});}
          catch(error){navigationErrors.push(error.name==='TimeoutError'?'READINESS_TIMEOUT':'READINESS_FAILED');}
        }else await wait(windowMs);
        // A pending navigation may never create an execution context. Do not evaluate a missing document.
        const metrics=documentReceived?await page.evaluate(base=>{
          if(!location.href.startsWith(base+'/') || !globalThis.pagesMeasurement)return null;
          const navigation=performance.getEntriesByType('navigation')[0],metrics=globalThis.pagesMeasurement;
          return {documentTtfbMs:navigation?.responseStart>0?navigation.responseStart-navigation.requestStart:null,
            htmlReadyMs:navigation?.responseEnd>0?navigation.responseEnd:null,loadMs:navigation?.loadEventEnd>0?navigation.loadEventEnd:null,
            fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,lcpLastObserved:metrics.lcp,
            productsReadyMs:metrics.productsReadyMs,menuReadyMs:metrics.menuReadyMs,observedUntilMs:performance.now(),
            productCards:document.querySelectorAll('#featured-products article').length,statusVisible:!document.getElementById('page-status')?.hidden,
            resourceTimingEntries:performance.getEntriesByType('resource').length,
            navigationTiming:navigation?Object.fromEntries(['startTime','fetchStart','domainLookupStart','domainLookupEnd','connectStart','secureConnectionStart','connectEnd','requestStart','responseStart','responseEnd','domContentLoadedEventEnd'].map(name=>[name,navigation[name]])):null,
            diagnostics:metrics.longTasks?{lcpCandidates:metrics.lcpCandidates,longTasks:metrics.longTasks,fontEvents:metrics.fontEvents,
              resources:performance.getEntriesByType('resource').map(entry=>({url:entry.name,startTime:entry.startTime,responseEnd:entry.responseEnd,duration:entry.duration,initiator:entry.initiatorType,renderBlockingStatus:entry.renderBlockingStatus}))}:null};
        },base).catch(()=>null):null;
        const observed=[...requests.values()];
        const timing=documentNetwork?.timing;
        const proxyLookupMs=timing?round(timing.proxyStart>=0 && timing.proxyEnd>=timing.proxyStart?timing.proxyEnd-timing.proxyStart:0):null;
        let trace=null;
        if(options.trace){
          const complete=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));await session.send('Tracing.end');await complete;
          const content=JSON.stringify({traceEvents}),file=path.join(traceDirectory,`${variant}-${scenario}-${profile}-${index}.json`);
          fs.writeFileSync(file,content);trace={file,sha256:createHash('sha256').update(content).digest('hex'),bytes:Buffer.byteLength(content)};
        }
        const diagnostics=options.diagnostics && metrics?{...metrics.diagnostics,
          resources:metrics.diagnostics.resources.map(({url,...resource})=>({...describeUrl(url),...resource})),
          waterfall:observed.map(({startTimestamp,responseTimestamp,endTimestamp,...request})=>({...request,startMs:round((startTimestamp-documentNetwork.startTimestamp)*1000),responseMs:round((responseTimestamp-documentNetwork.startTimestamp)*1000),endMs:round((endTimestamp-documentNetwork.startTimestamp)*1000)}))}:null;
        const result={variant,scenario,profile,sample:index,simulationDelayMs:scenario==='cold'?30000:null,
          observationWindowMs:scenario==='active'?null:windowMs,elapsedMs:round(performance.now()-started),
          documentTtfbMs:round(metrics?.documentTtfbMs),htmlReadyMs:round(metrics?.htmlReadyMs),fcpMs:round(metrics?.fcpMs),
          lcpLastObserved:metrics?.lcpLastObserved || null,loadMs:round(metrics?.loadMs),productsReadyMs:round(metrics?.productsReadyMs),menuReadyMs:round(metrics?.menuReadyMs),
          observedUntilMs:round(metrics?.observedUntilMs),productCards:metrics?.productCards ?? null,statusVisible:metrics?.statusVisible ?? null,
          resourceTimingEntries:metrics?.resourceTimingEntries ?? null,requestCount:observed.length,encodedBytesObserved:observed.reduce((sum,request)=>sum+request.bytes,0),
          unfinishedRequests:observed.filter(request=>!request.complete).length,requestErrors:observed.filter(request=>request.error).map(request=>({type:request.type,code:request.error})),
          navigationErrors,pageErrors,blockedThirdParty};
        Object.assign(result,{navigationTiming:metrics?.navigationTiming || null,documentNetwork:documentReceived?{proxyLookupMs,timing,headersObservedMs:round((documentNetwork.responseTimestamp-documentNetwork.startTimestamp)*1000)}:null,diagnostics,trace});
        samples.push(result);console.info(JSON.stringify({variant,scenario,profile,sample:index,documentTtfbMs:result.documentTtfbMs,fcpMs:result.fcpMs,lcpMs:round(result.lcpLastObserved?.startTime),productsReadyMs:result.productsReadyMs,menuReadyMs:result.menuReadyMs}));
      }finally{
        await context.close();await navigation;
        for(const timer of timers)clearTimeout(timer);timers.clear();apiServer.closeAllConnections();
      }
    }
    if(options.scenarios.includes('active'))for(const profile of options.profiles)for(let index=0;index<options.activeSamples;index++)for(const variant of ['coupled','pages'])await sample(variant,'active',profile,index);
    for(const scenario of ['cold','offline'])if(options.scenarios.includes(scenario))for(const variant of ['coupled','pages'])await sample(variant,scenario,'local',0);
    const result={date:new Date().toISOString(),node:process.version,chrome:browser.version(),baseline,
      methodology:{database:'One shared temporary SQLite fixture, migrated/seeded; connect measured before browsing',connectMs,
        viewport:{width:1440,height:1000},cache:'disabled; fresh context per sample',serviceWorkers:'blocked',thirdParties:'all blocked, including Maps',
        origins:'two loopback listeners on ephemeral ports; API CORS allows exactly both',activeSamples:options.activeSamples,profiles:options.profiles,
        browserProxy:options.directLoopback?'--no-proxy-server only for this temporary Chrome and loopback harness; system settings unchanged':'system browser proxy configuration; CDP proxy phase recorded separately from TTFB',
        diagnostics:options.diagnostics,trace:options.trace,traceDirectory,
        constrainedProfile:'10Mbps down,5Mbps up,40ms latency; no CPU throttle',cold:'gateway withholds all coupled requests or only separated API for30s; process/SQLite stay alive',
        offline:'gateway accepts HTTP requests without responding; it does not abort them',
        lcp:'last observed candidate, not final LCP; cold/offline windows35s/25s with no click/focus/input',menuReady:'MutationObserver sees data-session-role written by layout; functional clicks tested separately',
        bytes:'sum of CDP Network.loadingFinished.encodedDataLength for allowed origins, including document; pending/failed responses are incomplete, not total traffic',
        requestCount:'allowed-origin CDP requests, including document; external blocked requests counted separately',
        scope:'Local static-host model, not Cloudflare CDN/TLS/cache performance or measured Render cold start'},
      artifact:{files:artifact.files,bytes:artifact.bytes},samples};
    const destination=path.join(os.tmpdir(),'farmacia-pages-performance-'+options.label+'.json');fs.writeFileSync(destination,JSON.stringify(result,null,2));console.info('RESULT '+destination);
  }finally{
    for(const timer of timers)clearTimeout(timer);timers.clear();await browser?.close();
    await Promise.all([close(staticServer),close(apiServer)]);await db?.$disconnect();
    const absolute=path.resolve(directory),temporary=path.resolve(os.tmpdir());
    if(path.dirname(absolute)===temporary && path.basename(absolute).startsWith('farmacia-pages-measure-'))fs.rmSync(absolute,{recursive:true,force:true});
  }
}
if(require.main===module){
  if(process.argv.includes('--help'))console.info('node scripts/measure-pages.cjs [label] --baseline-root MVC_FRONTEND [--active-samples 1..3] [--scenarios active,cold,offline] [--profiles local,10Mbps-40ms] [--diagnostics] [--trace] [--direct-loopback]\nThe baseline is captured from the supplied source before synchronization; restore its ZIP to reproduce it later. Outputs JSON/traces in TEMP; uses temporary SQLite and loopback only. Direct mode disables proxy lookup only in this temporary Chrome, never system settings. Traces add overhead and must not replace the untraced comparison.');
  else{let options;try{options=argumentsFor(process.argv.slice(2));}catch(_){console.error('Argumentos inválidos. Consulta --help.');process.exitCode=1;}
    if(options)measure(options).catch(error=>{console.error('No se pudo completar la medición local ('+(/^[A-Za-z]+Error$/.test(error.name)?error.name:'Error')+').');process.exitCode=1;});}
}
module.exports={argumentsFor,measure,snapshot};
