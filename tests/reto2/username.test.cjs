const {test}=require('node:test');
const assert=require('node:assert/strict');
const validation=require('../../src/models/ecuador.js');

test('el nombre de usuario usa un identificador normalizado y acotado',()=>{
  assert.equal(validation.normalizeUsername(' Administrador '),'administrador');
  assert.equal(validation.normalizeUsername('Gestor_01.local'),'gestor_01.local');
  for(const value of [null,undefined,4,{},[],true,'ab','1gestor','área','admin@example.ec','<admin>','a'.repeat(41),'admin/../x','admin gestor']){
    assert.equal(validation.normalizeUsername(value),null);
  }
});
