const {test,after}=require('node:test'),assert=require('node:assert/strict');
const {app,db}=require('./fixture.cjs');let server;
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.$disconnect();});
test('el canal avisa escrituras públicas confirmadas y no emite datos privados',async()=>{
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const controller=new AbortController(),origin='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(origin+'/api/actualizaciones',{signal:controller.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  async function event(){for(;;){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').find(line=>line.startsWith('data:'));if(data)return JSON.parse(data.slice(5));}const {value,done}=await reader.read();assert.equal(done,false);buffer+=decoder.decode(value,{stream:true});}}
  const first=await event();assert.match(first.revision,/^[a-f0-9]{32}$/);assert.deepEqual(Object.keys(first),['revision']);
  const product=await db.producto.findFirst();await db.producto.update({where:{id:product.id},data:{nombre:product.nombre+' actualizado'}});
  const started=performance.now(),next=await event();assert.notEqual(next.revision,first.revision);assert.ok(performance.now()-started<3000);
  const marker=await db.revisionCatalogo.findUnique({where:{id:'catalogo'}}),user=await db.usuario.findFirst();await db.usuario.update({where:{id:user.id},data:{nombre:'Nombre privado'}});
  assert.equal((await db.revisionCatalogo.findUnique({where:{id:'catalogo'}})).token,marker.token);
  await assert.rejects(db.$transaction(async tx=>{await tx.producto.update({where:{id:product.id},data:{nombre:'Cambio revertido'}});throw new Error('rollback');}));
  assert.equal((await db.revisionCatalogo.findUnique({where:{id:'catalogo'}})).token,marker.token);
 }finally{controller.abort();}
});
