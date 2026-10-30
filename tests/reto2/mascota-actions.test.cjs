const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function actions(){
  const file=path.resolve(__dirname,'../../frontend/controllers/mascota.js');
  let source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?$/gm,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(file).href));
  return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).activateMascotaAction;
}
test('acciones permitidas de registro y checkout activan controles reales y enfocan su formulario',async()=>{
  const activate=await actions();
  for(const [href,focusSelector] of [['#show-register','#register-nombre'],['#checkout-next','#delivery-form input:not([type=hidden])']]){
    let clicks=0,focus=0;const button={disabled:false,closest:()=>null,click:()=>clicks++};const input={closest:()=>null,focus:()=>focus++};
    const doc={getElementById:id=>id===href.slice(1)?button:null,querySelector:selector=>selector===focusSelector?input:null};
    assert.equal(activate(href,doc),true);assert.equal(clicks,1);assert.equal(focus,1);
  }
});
test('no activa controles deshabilitados, ocultos ni destinos arbitrarios',async()=>{
  const activate=await actions();let clicks=0;
  const button={disabled:true,closest:()=>null,click:()=>clicks++};const doc={getElementById:()=>button,querySelector:()=>null};
  assert.equal(activate('#checkout-next',doc),true);assert.equal(clicks,0);
  button.disabled=false;button.closest=()=>({hidden:true});activate('#show-register',doc);assert.equal(clicks,0);
  assert.equal(activate('#checkout-clear',doc),false);assert.equal(activate('javascript:alert(1)',doc),false);assert.equal(clicks,0);
});
