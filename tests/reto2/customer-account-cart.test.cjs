'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
test('recompra acumula cantidades en una sola escritura y rechaza stock o selección inválida',async()=>{
 const {mergeReorder}=await import('../../frontend/models/customer-account.js');
 const proposal={items:[{productoId:'test-a',cantidadPermitida:3,stock:4},{productoId:'test-b',cantidadPermitida:0,stock:10}]};
 const original={'test-a':2,'kept-product':1};
 assert.deepEqual(mergeReorder(original,proposal,{'test-a':2}),{'test-a':4,'kept-product':1});assert.deepEqual(original,{'test-a':2,'kept-product':1});
 for(const selected of [{'test-a':3},{'test-b':1},{'alien':1},{'test-a':-1},{'test-a':1.5},{}])assert.throws(()=>mergeReorder(original,proposal,selected));
});
