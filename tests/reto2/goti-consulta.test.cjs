const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createConsultation}=require('../../backend/controllers/consulta-goti.cjs');
const run=(consult,pregunta,extra={})=>consult({body:{pregunta,...extra}},{json:({data})=>data});
const generated=plan=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(plan)}]}}]});

test('interpreta dos temas coloquiales y solo devuelve información propia',async()=>{
  const consult=createConsultation({key:'test',fetcher:async(url,options)=>{
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
    assert.equal(options.headers['x-goog-api-key'],'test');
    assert.deepEqual(Object.keys(options.headers).sort(),['Content-Type','x-goog-api-key']);
    const payload=JSON.parse(options.body);
    assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text),{pregunta:'ñaño, ¿hasta qué hora atienden y hacen envíos?',temaAnterior:null});
    return generated({temas:['horario','entrega'],texto:'Dato inventado'});
  }});
  const reply=await run(consult,'ñaño, ¿hasta qué hora atienden y hacen envíos?');
  assert.equal(reply.origen,'gemini');assert.match(reply.texto,/19:00/);assert.match(reply.texto,/dirección/);assert.doesNotMatch(reply.texto,/inventado/);
});
test('consulta el precio público actual y conserva la restricción al repreguntar',async()=>{
  const item={id:'p1',nombre:'Gel',stock:2,precio:1.4};
  const consult=createConsultation({key:'',products:async q=>{assert.equal(q,'gel');return {items:[item]};},findProduct:async id=>{assert.equal(id,item.id);return {...item,soloConsulta:true};}});
  const first=await run(consult,'bro, ¿a cómo sale el gel?');
  assert.match(first.texto,/1\.40/);assert.equal(first.referencia,'p1');
  const next=await run(consult,'¿Y ahora?',{temaAnterior:first.tema,referencia:first.referencia});
  assert.match(next.texto,/Consulta precio/);assert.doesNotMatch(next.texto,/1\.40/);
});
test('datos sensibles y preguntas clínicas reconocidas se resuelven antes de llamar a Google',async()=>{
  let calls=0;const consult=createConsultation({key:'test',fetcher:async()=>{calls++;}});
  for(const question of ['mi correo es a@example.ec','mi cédula es 1234567890','¿qué dosis tomo?'])assert.equal((await run(consult,question)).origen,'local');
  assert.equal(calls,0);
});
test('saluda, responde a un agradecimiento y recuerda el horario en una repregunta',async()=>{
  const consult=createConsultation({key:''});
  assert.match((await run(consult,'¡Buenas tardes, Goti!')).texto,/Hola/);
  const first=await run(consult,'¿Atienden y hacen entregas a domicilio?');
  assert.match(first.texto,/19:00/);assert.match(first.texto,/domicilio/);
  const thanks=await run(consult,'Gracias, pana',{temaAnterior:first.tema});
  assert.match(thanks.texto,/Con gusto/);
  assert.match((await run(consult,'¿Y el domingo?',{temaAnterior:thanks.tema})).texto,/domingo queda fuera/);
});
test('cuota, red y respuestas no admitidas recuperan la ayuda local',async()=>{
  for(const fetcher of [()=>generated({temas:['update-product']}),()=>new Response(null,{status:429}),()=>Promise.reject(Error('offline'))]){
    const reply=await run(createConsultation({key:'test',fetcher}),'¿Hacen envíos a domicilio?');
    assert.equal(reply.origen,'local');assert.match(reply.texto,/cobertura/);
  }
});
test('rechaza contenido arbitrario en el contrato y no busca términos generados fuera de la pregunta',async()=>{
  const consult=createConsultation({key:'test',fetcher:()=>generated({temas:['producto'],producto:'inventado'}),products:()=>assert.fail('consulta inesperada')});
  for(const [q,extra] of [['x'.repeat(301),{}],['hola',{rol:'admin'}],['hola',{temaAnterior:'inventado'}],['hola',{referencia:42}]]){
    await assert.rejects(run(consult,q,extra),{code:'INVALID_QUESTION'});
  }
  assert.match((await run(consult,'¿Cuánto cuesta el gel?')).texto,/nombre del producto/);
});
