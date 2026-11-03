const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {AsyncLocalStorage}=require('node:async_hooks');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createEmailVerification,requiresVerification}=require('../../server/models/email-verification.cjs');
const mail=require('../../server/models/email-delivery.cjs');
const digest=token=>createHash('sha256').update(token).digest('hex');
const baseUser=()=>({id:'cliente-sintetico',nombre:'Cliente Prueba',email:'cliente@example.ec',activo:true,emailVerificationRequired:true,emailVerifiedAt:null,tokenVersion:3});
const env=()=>({NODE_ENV:'production',EMAIL_VERIFICATION_ENABLED:'true',EMAIL_PUBLIC_ORIGIN:'https://tienda.example.ec',RESEND_API_KEY:'re_synthetic_key_not_real_2026',EMAIL_FROM:'confirmar@example.ec'});
const settings=()=>({emailVerification:mail.configuration(env(),{production:true,origins:['https://tienda.example.ec']})});
const invalid=error=>error.status===422 && error.code==='EMAIL_VERIFICATION_INVALID';

// Prisma-shaped in-memory store: serialized transactions with rollback. No DB, setup or network.
function store(user=baseUser()){
  let users=new Map([[user.id,structuredClone(user)]]),rows=new Map(),queue=Promise.resolve();const context=new AsyncLocalStorage();
  const matches=(row,where)=>Object.entries(where).every(([key,value])=>{
    const actual=row[key];if(value && typeof value==='object' && !(value instanceof Date))return Object.entries(value).every(([op,limit])=>op==='gt'?actual>limit:op==='lte'?actual<=limit:false);
    return value instanceof Date?actual?.getTime()===value.getTime():actual===value;
  });
  const db={
    get rows(){return rows;},get users(){return users;},get inTransaction(){return Boolean(context.getStore());},
    usuario:{
      async findUnique({where}){const found=users.get(where.id);return found?structuredClone(found):null;},
      async updateMany({where,data}){let count=0;for(const user of users.values())if(matches(user,where)){for(const [key,value] of Object.entries(data))user[key]=value && typeof value==='object' && 'increment' in value?user[key]+value.increment:structuredClone(value);count++;}return {count};},
    },
    emailVerification:{
      async findUnique({where}){const row=where.usuarioId?rows.get(where.usuarioId):[...rows.values()].find(row=>row.tokenHash===where.tokenHash);return row?structuredClone(row):null;},
      async create({data}){if(rows.has(data.usuarioId) || [...rows.values()].some(row=>row.tokenHash===data.tokenHash))throw Object.assign(new Error('Unique row'),{code:'P2002'});assert.ok(data.expiresAt>data.createdAt);rows.set(data.usuarioId,structuredClone(data));return structuredClone(data);},
      async updateMany({where,data}){let count=0;for(const row of rows.values())if(matches(row,where)){Object.assign(row,structuredClone(data));assert.ok(row.expiresAt>row.createdAt);count++;}return {count};},
      async deleteMany({where}){let count=0;for(const [id,row] of rows)if(matches(row,where)){rows.delete(id);count++;}return {count};},
    },
    $transaction(action,options){
      assert.equal(options.isolationLevel,'Serializable');
      const run=queue.then(()=>context.run(true,async()=>{const before=structuredClone({users,rows});try{return await action(db);}catch(error){users=before.users;rows=before.rows;throw error;}}));queue=run.catch(()=>{});return run;
    },
  };return db;
}
function fixture(){
  const db=store(),messages=[],metrics=[];let clock=Date.parse('2026-11-02T12:00:00Z');
  const model=createEmailVerification({db,now:()=>new Date(clock),emit:outcome=>metrics.push(outcome),deliver:async message=>{assert.equal(db.inTransaction,false);messages.push(message);}});
  return {db,messages,metrics,model,user:baseUser(),advance:ms=>clock+=ms};
}

test('configuración desactivada por defecto y activación estricta sin revelar secretos',()=>{
  assert.deepEqual(mail.configuration({}),{enabled:false,publicOrigin:null,apiKey:null,from:null});
  const good=env();assert.equal(mail.configuration(good,{production:true,origins:[good.EMAIL_PUBLIC_ORIGIN]}).enabled,true);
  for(const override of [{EMAIL_VERIFICATION_ENABLED:'yes'},{EMAIL_PUBLIC_ORIGIN:'https://otro.example.ec'},{EMAIL_PUBLIC_ORIGIN:'https://tienda.example.ec/'},{EMAIL_PUBLIC_ORIGIN:'https://user:private@tienda.example.ec'},{EMAIL_PUBLIC_ORIGIN:'https://tienda.example.ec/path'},{EMAIL_PUBLIC_ORIGIN:'https://tienda.example.ec#token=private'},{RESEND_API_KEY:'secret-with-newline\r\n'},{EMAIL_FROM:'remitente@example.ec\r\nBcc: otra@example.ec'},{EMAIL_FROM:'Nombre <remitente@example.ec>'}]){
    assert.throws(()=>mail.configuration({...good,...override},{production:true,origins:[good.EMAIL_PUBLIC_ORIGIN]}),error=>!error.message.includes(good.RESEND_API_KEY) && !error.message.includes('user:private') && !error.message.includes('Bcc:'));
  }
  assert.throws(()=>mail.configuration({...good,EMAIL_PUBLIC_ORIGIN:'http://localhost:3300',NODE_ENV:'development'},{origins:['http://localhost:3300']}));
  assert.equal(mail.configuration({...good,EMAIL_PUBLIC_ORIGIN:'http://localhost:3300',NODE_ENV:'test'},{origins:['http://localhost:3300']}).publicOrigin,'http://localhost:3300');
});

test('config principal incluye la opción privada sin leer .env durante la prueba',()=>{
  const source=fs.readFileSync(path.resolve('server/config.cjs'),'utf8'),module={exports:{}};
  const sandbox={module,URL,__dirname:path.resolve('server'),process:{env:{...env(),JWT_SECRET:'SyntheticJwtSecret_12345678901234567890',DATABASE_URL:'file:unused.db',CORS_ORIGIN:'https://tienda.example.ec'}},require:name=>name==='node:path'?path:name==='dotenv'?{config(){}}:name==='./models/email-delivery.cjs'?mail:(()=>{throw new Error('Unexpected import');})()};
  vm.runInNewContext(source,sandbox);const config=module.exports();assert.equal(config.emailVerification.enabled,true);assert.equal(config.emailVerification.publicOrigin,'https://tienda.example.ec');
});

test('enlace fijo con fragmento, HTML escapado y Resend con timeout y redirect:error',async()=>{
  let url,options;const token=Buffer.alloc(32,7).toString('base64url'),config=settings().emailVerification;
  const result=await mail.sendVerification({to:'cliente@example.ec',name:'Cliente <script> & "Prueba"',token,config,idempotencyKey:'synthetic-idempotency-123'}, {fetch:async(endpoint,request)=>{url=endpoint;options=request;return new Response(JSON.stringify({id:'synthetic-message'}),{status:200});}});
  assert.deepEqual(result,{accepted:true});assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.signal.aborted,false);assert.equal(options.headers['Idempotency-Key'],'synthetic-idempotency-123');
  const payload=JSON.parse(options.body);assert.equal(payload.from,'Farmacia Reina del Cisne <confirmar@example.ec>');assert.deepEqual(payload.to,['cliente@example.ec']);assert.match(payload.subject,/Farmacia Reina del Cisne/);assert.match(payload.html,/&lt;script&gt; &amp; &quot;Prueba&quot;/);assert.doesNotMatch(payload.html,/<script>/);
  const link=mail.confirmationUrl(config.publicOrigin,token),parsed=new URL(link);assert.equal(parsed.origin,config.publicOrigin);assert.equal(parsed.pathname,'/confirmar-correo');assert.equal(parsed.search,'');assert.equal(parsed.hash,'#token='+token);assert.ok(payload.text.includes(link));assert.ok(payload.html.includes(link));assert.doesNotMatch(JSON.stringify(result),new RegExp(token));
});

test('error de proveedor no devuelve contenido, destinatario, clave ni token',async()=>{
  const token=Buffer.alloc(32,8).toString('base64url'),config=settings().emailVerification;
  await assert.rejects(mail.sendVerification({to:'cliente@example.ec',name:'Cliente',token,config},{fetch:async()=>new Response(config.apiKey+' '+token+' cliente@example.ec',{status:500})}),error=>error.code==='EMAIL_DELIVERY_FAILED' && !error.message.includes(token) && !error.message.includes(config.apiKey) && !error.message.includes('cliente@example.ec'));
  await assert.rejects(mail.sendVerification({to:'cliente@example.ec',name:'Cliente',token,config},{fetch:async()=>{throw new Error(config.apiKey+' '+token);}}),error=>error.code==='EMAIL_DELIVERY_FAILED' && !error.message.includes(token));
});

test('emisión guarda sólo hash, caduca en una hora y entrega fuera de la transacción',async()=>{
  const f=fixture(),outcome=await f.model.issue(f.user,settings());assert.deepEqual(outcome,{status:'sent'});assert.equal(f.messages.length,1);
  const token=f.messages[0].token,row=f.db.rows.get(f.user.id);assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(row.tokenHash,digest(token));assert.match(row.tokenHash,/^[a-f0-9]{64}$/);assert.equal(row.expiresAt-row.createdAt,3600000);assert.equal(row.email,f.user.email);
  assert.ok(!JSON.stringify([...f.db.rows]).includes(token));assert.ok(!JSON.stringify(outcome).includes(token));assert.ok(!f.messages[0].idempotencyKey.includes(f.user.id));assert.ok(!f.messages[0].idempotencyKey.includes(f.user.email));assert.deepEqual(f.metrics,['sent']);
});

test('cooldown atómico y rotación rechazan el enlace anterior al cumplirse sesenta segundos',async()=>{
  const f=fixture();const results=await Promise.all([f.model.issue(f.user,settings()),f.model.issue(f.user,settings())]);assert.deepEqual(results.map(r=>r.status).sort(),['cooldown','sent']);assert.equal(f.messages.length,1);
  const old=f.messages[0].token;f.advance(59999);assert.equal((await f.model.issue(f.user,settings())).status,'cooldown');f.advance(1);assert.equal((await f.model.issue(f.user,settings())).status,'sent');
  const fresh=f.messages[1].token;assert.notEqual(fresh,old);await assert.rejects(f.model.consume(old),invalid);assert.deepEqual(await f.model.consume(fresh),{verified:true});
});

test('consumo único atómico incrementa tokenVersion y no inicia sesión',async()=>{
  const f=fixture();await f.model.issue(f.user,settings());const token=f.messages[0].token;
  const results=await Promise.allSettled([f.model.consume(token),f.model.consume(token)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(results.find(r=>r.status==='fulfilled').value,{verified:true});assert.ok(invalid(results.find(r=>r.status==='rejected').reason));
  const user=f.db.users.get(f.user.id);assert.ok(user.emailVerifiedAt instanceof Date);assert.equal(user.tokenVersion,4);assert.equal(f.db.rows.size,0);await assert.rejects(f.model.consume(token),invalid);
});

test('token vencido, correo cambiado o usuario desactivado no confirma la cuenta',async()=>{
  for(const scenario of ['expired','changed','inactive']){
    const f=fixture();await f.model.issue(f.user,settings());if(scenario==='expired')f.advance(3600000);if(scenario==='changed')f.db.users.get(f.user.id).email='nuevo@example.ec';if(scenario==='inactive')f.db.users.get(f.user.id).activo=false;
    await assert.rejects(f.model.consume(f.messages[0].token),invalid);assert.equal(f.db.users.get(f.user.id).emailVerifiedAt,null);assert.equal(f.db.users.get(f.user.id).tokenVersion,3);assert.equal(f.db.rows.size,0);
  }
});

test('fallo de actualización revierte la eliminación del token y mantiene error público genérico',async()=>{
  const f=fixture();await f.model.issue(f.user,settings());const update=f.db.usuario.updateMany;f.db.usuario.updateMany=async()=>{throw new Error('sensitive database content');};
  await assert.rejects(f.model.consume(f.messages[0].token),error=>error.status===503 && error.code==='EMAIL_VERIFICATION_UNAVAILABLE' && !error.message.includes('sensitive'));assert.equal(f.db.rows.size,1);assert.equal(f.db.users.get(f.user.id).emailVerifiedAt,null);
  f.db.usuario.updateMany=update;assert.deepEqual(await f.model.consume(f.messages[0].token),{verified:true});
});

test('fallo tardío de entrega elimina sólo su hash y conserva una emisión más nueva',async()=>{
  const db=store(),messages=[],metrics=[];let clock=Date.parse('2026-11-02T12:00:00Z'),rejectFirst,started;
  const firstStarted=new Promise(resolve=>started=resolve),deliveryFailed=new Promise((_,reject)=>rejectFirst=reject);
  const model=createEmailVerification({db,now:()=>new Date(clock),emit:code=>metrics.push(code),deliver:async message=>{messages.push(message);if(messages.length===1){started();await deliveryFailed;}}});
  const pending=model.issue(baseUser(),settings());await firstStarted;clock+=60000;assert.equal((await model.issue(baseUser(),settings())).status,'sent');
  rejectFirst(new Error('upstream '+messages[0].token+' '+baseUser().email));assert.equal((await pending).status,'unavailable');assert.equal(db.rows.get(baseUser().id).tokenHash,digest(messages[1].token));
  await assert.rejects(model.consume(messages[0].token),invalid);assert.deepEqual(await model.consume(messages[1].token),{verified:true});assert.ok(metrics.every(value=>!value.includes('@') && !messages.some(message=>value.includes(message.token))));
});

test('desactivar envíos no desactiva requisitos pendientes ni impide consumir el enlace existente',async()=>{
  const f=fixture();assert.equal(requiresVerification(f.user),true);assert.equal(requiresVerification({...f.user,emailVerificationRequired:false}),false);assert.equal(requiresVerification({...f.user,emailVerifiedAt:new Date()}),false);
  assert.deepEqual(await f.model.issue(f.user,{emailVerification:{enabled:false}}),{status:'disabled'});assert.equal(f.messages.length,0);assert.equal(f.db.rows.size,0);
  await f.model.issue(f.user,settings());assert.deepEqual(await f.model.consume(f.messages[0].token),{verified:true});assert.equal(requiresVerification(f.db.users.get(f.user.id)),false);
  assert.deepEqual(await f.model.issue(f.user,settings()),{status:'not-required'});
});

test('entrada de token malformada nunca consulta una base ni incluye su valor en el error',async()=>{
  const model=createEmailVerification({db:{$transaction(){throw new Error('Unexpected database access');}}});
  for(const token of [null,{},'',Buffer.alloc(31).toString('base64url'),'a'.repeat(44),'<script>'])await assert.rejects(model.consume(token),invalid);
});
