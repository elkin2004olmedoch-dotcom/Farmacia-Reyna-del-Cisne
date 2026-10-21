const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
process.env.PERF_DIAGNOSTICS='1';
const {db,request,directory}=require('./fixture.cjs');
after(async()=>{delete process.env.PERF_DIAGNOSTICS;await db.$disconnect();if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'))fs.rmSync(directory,{recursive:true,force:true});});

test('diagnóstico optativo mide HTTP y SQL sin registrar parámetros ni secretos',async()=>{
  const messages=[],original=console.info;console.info=value=>messages.push(value);
  try{
    const secret='synthetic-secret-not-for-logs';
    const response=await request.get('/api/productos?pageSize=4&q='+secret).set('Authorization','Bearer '+secret);
    assert.equal(response.status,200);assert.equal(response.headers['cache-control'],'no-store');
    assert.match(response.headers['server-timing']||'',/express_headers;dur=\d/);
    const privateResponse=await request.get('/api/pedidos');assert.equal(privateResponse.status,401);
    await db.$queryRaw`SELECT ${secret}`;
    await require('../../server/diagnostics.cjs').connect(db);
    const concurrent=await Promise.all([request.get('/api/salud'),request.get('/api/productos?pageSize=4')]);
    assert.notEqual(concurrent[0].headers['x-request-id'],concurrent[1].headers['x-request-id']);
    const events=messages.map(message=>JSON.parse(message));
    assert.ok(events.some(event=>event.event==='prisma_connect' && event.success && Number.isFinite(event.durationMs)));
    assert.ok(events.some(event=>event.event==='http_start'));
    assert.ok(events.some(event=>event.event==='http_finish' && event.requestId===response.headers['x-request-id'] && event.durationMs>=0));
    const sql=events.filter(event=>event.event==='sql');assert.ok(sql.length>0);
    assert.ok(sql.every(event=>Number.isFinite(event.queryRoundTripMs) && !('requestId' in event)));
    assert.ok(!messages.join('\n').includes(secret));
    assert.ok(events.every(event=>!('query' in event) && !('params' in event) && !('headers' in event) && !('body' in event)));
  }finally{console.info=original;}
});

test('diagnóstico desactivado no agrega cabeceras ni eventos y la portada no consulta SQL',async()=>{
  const messages=[],original=console.info;console.info=value=>messages.push(value);
  try{
    for(const flag of ['0','true','']){
      process.env.PERF_DIAGNOSTICS=flag;
      const response=await request.get('/');assert.equal(response.status,200);
      assert.equal(response.headers['server-timing'],undefined);assert.equal(response.headers['x-diagnostic-boot'],undefined);
    }
    assert.equal(messages.length,0);
    process.env.PERF_DIAGNOSTICS='1';
    const response=await request.get('/');assert.equal(response.status,200);
    assert.ok(!messages.some(message=>JSON.parse(message).event==='sql'));
  }finally{process.env.PERF_DIAGNOSTICS='1';console.info=original;}
});

test('el arranque diagnóstico escucha sin forzar una conexión Prisma',async()=>{
  const child=spawn(process.execPath,['server/index.cjs'],{env:{...process.env,PERF_DIAGNOSTICS:'1',PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const events=[];let pending='';
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Diagnostic startup timed out')),8000);
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited before listening: '+code));});
      child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(!line.startsWith('{'))continue;const event=JSON.parse(line);events.push(event);if(event.event==='startup' && event.phase==='listening'){clearTimeout(timer);resolve();}}});
    });
    assert.ok(events.some(event=>event.event==='startup' && event.phase==='app_ready'));
    assert.ok(!events.some(event=>event.event==='sql' || event.event==='prisma_connect'));
  }finally{if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;}}
});
