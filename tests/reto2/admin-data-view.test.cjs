const {test}=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test('la consulta de tablas conserva códigos HTTP y valores de auditoría sin interpretarlos como estado de negocio',async t=>{
  const previous=globalThis.document,nodes=new Map();
  globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};t.after(()=>{if(previous)globalThis.document=previous;else delete globalThis.document;});
  const {tableView}=await import(pathToFileURL(path.resolve('src/views/admin.js')).href);
  tableView('datos',{items:[{id:'audit-fixture',accion:'user.create',status:201}],total:1,page:1,pageSize:20,resource:{label:'Auditoría administrativa',columns:[{key:'id',label:'ID'},{key:'accion',label:'Acción'},{key:'status',label:'Estado HTTP'}]}});
  assert.match(nodes.get('admin-table').innerHTML,/<td>201<\/td>/);
  assert.match(nodes.get('admin-table').innerHTML,/<td>user\.create<\/td>/);
});
