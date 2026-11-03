const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const file=path.join(root,'frontend/views/products.js');
const source=fs.readFileSync(file,'utf8').replace(/(from\s+|import\s+)(['"])(\.[^'"]+)\2/g,(_,prefix,quote,specifier)=>prefix+quote+(specifier==='../config.js'?'data:text/javascript;base64,'+Buffer.from('export const productImageUrl=value=>value;').toString('base64'):pathToFileURL(path.resolve(path.dirname(file),specifier)).href)+quote);
const views=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const product=()=>({id:'catalog-test',nombre:'Producto de prueba',categoria:'cuidado',descripcion:'Descripción del catálogo.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',precio:8,precioOriginal:10,descuentoPorcentaje:20,stock:4,ivaPorcentaje:15,laboratorio:'Laboratorio <prueba>',presentacion:'Caja de 20 unidades',principioActivo:'Dato del producto',concentracion:'10 mg',registroSanitario:'REG-PRUEBA',pvpMaximo:10});
function detail(view,item){
  const saved=Object.getOwnPropertyDescriptor(globalThis,'document');const target={innerHTML:''};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:()=>target}});
  try{view(item);return target.innerHTML;}finally{if(saved)Object.defineProperty(globalThis,'document',saved);else delete globalThis.document;}
}

test('tarjeta muestra presentación y laboratorio reales, escapa datos y conserva acciones e imagen',async()=>{
  const {productCard}=await views;const item=product();const html=productCard(item);
  assert.match(html,/Laboratorio &lt;prueba&gt;/);assert.match(html,/Caja de 20 unidades/);
  assert.match(html,/data-product-image/);assert.match(html,/alt="Envase de prueba" width="320" height="320"/);
  assert.match(html,/data-add="catalog-test"/);assert.match(html,/data-compare="catalog-test"/);
  assert.match(html,/4 unidades disponibles/);assert.match(html,/incluye IVA 15 %/);assert.match(html,/20% de descuento/);
  delete item.laboratorio;delete item.presentacion;
  assert.doesNotMatch(productCard(item),/product-card-meta|undefined|Laboratorio &lt;prueba&gt;/);
});

test('ficha reúne compra y disponibilidad, expone información existente y condiciones de entrega',async()=>{
  const {productView}=await views;const html=detail(productView,product());
  for(const id of ['zoom-product','detail-quantity','detail-add-form','detail-add-button','pharmaceutical-title'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/name="cantidad"/);assert.match(html,/width="600" height="600"/);assert.match(html,/data-product-image/);
  assert.match(html,/Laboratorio &lt;prueba&gt;/);assert.match(html,/REG-PRUEBA/);assert.match(html,/PVP máximo impreso:/);
  assert.match(html,/Retiro en farmacia/);assert.match(html,/tarifa al confirmar la dirección/i);assert.match(html,/href="catalogo.html"/);
});

test('receta, control especial, biológico, frío y agotados conservan sus límites de compra',async()=>{
  const {productCard,productView}=await views;
  for(const flag of ['requiereReceta','controlado','biologico','cadenaFrio']){
    const item={...product(),[flag]:true};const card=productCard(item);const html=detail(productView,item);
    assert.doesNotMatch(card,/data-add=/,flag);assert.match(card,/Coordinar con la farmacia/,flag);
    assert.match(html,/<button id="detail-add-button"[^>]*disabled/,flag);assert.match(html,/Coordina la atención farmacéutica/,flag);
  }
  const empty={...product(),stock:0};assert.match(productCard(empty),/data-add="catalog-test"[^>]*disabled/);assert.match(detail(productView,empty),/Producto agotado/);
});

test('catálogo vacío explica cómo recuperar resultados',async()=>{
  const {catalogView}=await views;const target={innerHTML:''};catalogView([],target);
  assert.match(target.innerHTML,/No encontramos productos/);assert.match(target.innerHTML,/restablece los filtros/);assert.match(target.innerHTML,/href="catalogo.html"/);
});
