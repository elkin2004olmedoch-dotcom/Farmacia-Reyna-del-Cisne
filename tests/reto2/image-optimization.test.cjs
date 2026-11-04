const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),sharp=require('sharp');
const paths=['assets/images/producto-bebe-pigeon','assets/images/producto-solar-eucerin'];
test('las fotos pesadas usan variantes WebP sin cambiar las referencias persistidas ni uploads',async()=>{
 const source=fs.readFileSync('frontend/config.js','utf8'),{productImageUrl,publicImageUrl}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const file of paths){assert.equal(productImageUrl(file+'.png'),file+'.webp');assert.equal(publicImageUrl(file+'.png'),file+'.png');}
 assert.equal(productImageUrl('assets/uploads/00000000-0000-4000-8000-000000000000.webp'),'assets/uploads/00000000-0000-4000-8000-000000000000.webp');assert.equal(productImageUrl('javascript:alert(1)'),'assets/images/producto-sin-imagen.svg');
});
test('las variantes conservan dimensiones y todos los píxeles visibles con menos bytes',async()=>{
 for(const file of paths){const original=fs.readFileSync('frontend/'+file+'.png'),optimized=fs.readFileSync('frontend/'+file+'.webp');assert.ok(optimized.length<original.length);
  const before=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true}),after=await sharp(optimized).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual(after.info,before.info);
  for(let i=0;i<before.data.length;i+=4){assert.equal(after.data[i+3],before.data[i+3]);if(before.data[i+3])assert.deepEqual(after.data.subarray(i,i+3),before.data.subarray(i,i+3));}
 }
});
