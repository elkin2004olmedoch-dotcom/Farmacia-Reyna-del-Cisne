const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {snapshot}=require('../../scripts/measure-pages.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-snapshot-'));
after(()=>{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('farmacia-pages-snapshot-'));fs.rmSync(directory,{recursive:true,force:true});});
test('baseline público conserva imports mjs y excluye uploads y archivos privados',()=>{
  const source=path.join(directory,'source'),output=path.join(directory,'snapshot');
  fs.mkdirSync(path.join(source,'controllers'),{recursive:true});fs.mkdirSync(path.join(source,'assets/uploads'),{recursive:true});
  fs.writeFileSync(path.join(source,'index.html'),'<!doctype html><script type="module" src="controllers/app.js"></script>');
  fs.writeFileSync(path.join(source,'controllers/app.js'),"import {label} from './helper.mjs'; export {label};");
  fs.writeFileSync(path.join(source,'controllers/helper.mjs'),"export const label='public helper';");
  fs.writeFileSync(path.join(source,'assets/uploads/private.png'),'private upload');fs.writeFileSync(path.join(source,'.env'),'PRIVATE_SYNTHETIC=value');
  const result=snapshot(source,output);
  assert.ok(fs.existsSync(path.join(output,'controllers/helper.mjs')),'baseline omite un módulo importado .mjs');
  assert.equal(fs.readFileSync(path.join(output,'controllers/helper.mjs'),'utf8'),"export const label='public helper';");
  assert.equal(result.files,3);assert.ok(result.manifest.some(file=>file.path==='controllers/helper.mjs'));
  assert.ok(!fs.existsSync(path.join(output,'assets/uploads')));assert.ok(!fs.existsSync(path.join(output,'.env')));
});
