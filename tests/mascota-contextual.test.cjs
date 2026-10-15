const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('el asistente renderiza accesos y textos según la ruta y la sección visible',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../frontend/controllers/mascota.js'),'utf8');
  for(const selector of ['#detail-add-button','#detail-add-form','[data-add]','.shop-cart','#checkout-next','#compare-picks','#show-register','#orders-list'])assert.ok(source.includes(selector),`detecta el control ${selector}`);
  assert.match(source,/data-quick-question/);
  assert.match(source,/MutationObserver/);
  assert.match(source,/farmacia:cart/);
});

test('la tienda estática carga el mismo asistente contextual que la aplicación MVC',()=>{
  for(const page of ['index.html','catalogo.html','producto.html','comparar.html','checkout.html','cuenta.html','pedidos.html','ayuda.html']){
    const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    assert.match(html,/js\/mascota\.js/,`${page} incluye las preguntas contextuales`);
  }
  assert.match(fs.readFileSync(path.join(__dirname,'../frontend/controllers/app.js'),'utf8'),/import\('\.\/mascota\.js'\)/);
});
