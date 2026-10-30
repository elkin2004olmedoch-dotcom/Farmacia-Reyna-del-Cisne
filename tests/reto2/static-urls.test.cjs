const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const upload='assets/uploads/00000000-0000-4000-8000-000000000000.webp';
const remote='https://api.example.test/'+upload;
const configStub='export const publicImageUrl=value=>globalThis.staticUrlResolver(value);';

// Evaluate the real module; replace only its browser/config dependencies.
async function load(relative,stubs={}){
  const file=path.join(root,relative);
  const source=fs.readFileSync(file,'utf8').replace(/(from\s+|import\s+)(['"])(\.[^'"]+)\2/g,(_,prefix,quote,specifier)=>{
    const target=Object.hasOwn(stubs,specifier)?'data:text/javascript;base64,'+Buffer.from(stubs[specifier]).toString('base64'):pathToFileURL(path.resolve(path.dirname(file),specifier)).href;
    return prefix+quote+target+quote;
  });
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
function globals(values){
  const saved=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  return ()=>{for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
}
const product=()=>({id:'producto-prueba',nombre:'Producto',categoria:'cuidado',descripcion:'Descripción pública',imagen:upload,alt:'Producto',precio:2,precioOriginal:2,descuentoPorcentaje:0,stock:3,requiereReceta:false});

test('tarjetas, ficha y campañas resuelven uploads sin cambiar la imagen persistida',async()=>{
  const nodes=new Map(['product-detail','promotions-note','promotions-list'].map(id=>[id,{innerHTML:'',textContent:''}]));
  const restore=globals({staticUrlResolver:value=>{assert.equal(value,upload);return remote;},document:{getElementById:id=>nodes.get(id)}});
  try{
    const views=await load('frontend/views/products.js',{'../config.js':configStub});
    const item=product();
    assert.ok(views.productCard(item).includes('src="'+remote+'"'));
    views.productView(item);assert.ok(nodes.get('product-detail').innerHTML.includes('src="'+remote+'"'));
    views.promotionView([{producto:item,productoId:item.id,titulo:'Campaña',descripcion:'Oferta',etiqueta:'Promo',descuentoPorcentaje:0}]);
    assert.ok(nodes.get('promotions-list').innerHTML.includes('src="'+remote+'"'));
    assert.equal(item.imagen,upload);
  }finally{restore();}
});

test('la vista previa administrativa resuelve uploads y conserva vacío oculto',async()=>{
  const image={hidden:true,src:'',removeAttribute(name){delete this[name];}};
  const restore=globals({staticUrlResolver:value=>{assert.equal(value,upload);return remote;},document:{getElementById:()=>image}});
  try{
    const {imagePreviewView}=await load('frontend/views/admin.js',{'../config.js':configStub});
    imagePreviewView('product',upload);assert.equal(image.src,remote);assert.equal(image.hidden,false);
    imagePreviewView('promotion','');assert.equal(image.hidden,true);assert.equal(image.src,undefined);
  }finally{restore();}
});

test('ampliar una imagen usa el mismo origen remoto sin alterar el producto',async()=>{
  const item=product(),listeners={},image={},quantity={value:'1'};
  const target={addEventListener:(name,callback)=>listeners[name]=callback};
  const dialog={querySelector:()=>image,showModal(){this.open=true;}};
  const restore=globals({staticUrlResolver:value=>{assert.equal(value,upload);return remote;},staticUrlProduct:item,location:{search:'?id='+item.id},document:{getElementById:id=>({'product-detail':target,'detail-quantity':quantity,'image-dialog':dialog})[id]}});
  try{
    const {productController}=await load('frontend/controllers/catalog.js',{
      '../config.js':configStub,
      '../models/catalog.js':'export const catalog={find:async()=>globalThis.staticUrlProduct};',
      '../models/cart.js':'export const cart={};',
      '../views/products.js':'export const catalogView=()=>{},productView=()=>{},promotionView=()=>{},comparisonView=()=>{};',
      '../views/common.js':'export const message=()=>{},busy=()=>{};',
      './updates.js':'export const watchUpdates=()=>{},preserveFocus=(target,render)=>render();',
    });
    await productController();
    listeners.click({target:{closest:selector=>selector==='#zoom-product'?{}:null}});
    assert.equal(image.src,remote);assert.equal(dialog.open,true);assert.equal(item.imagen,upload);
  }finally{restore();}
});

test('navegación marca la página actual con URL .html, limpia y raíz',async()=>{
  let links=[];
  const element={addEventListener(){}};
  const restore=globals({location:{pathname:'/'},document:{body:{dataset:{page:'home'}},getElementById:id=>id==='admin-nav-overlay'?null:element,querySelectorAll:selector=>selector==='.shop-nav a'?links:[],addEventListener(){}}});
  try{
    const {layoutController}=await load('frontend/controllers/layout.js',{
      '../models/auth.js':'export const auth={user:null};',
      '../models/cart.js':'export const cart={read:()=>({})};',
      '../models/events.js':'export const events=new EventTarget();',
      '../views/layout.js':'export const sessionView=()=>{};',
      '../views/common.js':'export const message=()=>{},busy=()=>{};',
    });
    for(const [pathname,expected] of [['/','index.html'],['/index.html','index.html'],['/catalogo.html','catalogo.html'],['/catalogo','catalogo.html'],['/catalogo/','catalogo.html']]){
      links=['index.html','catalogo.html','index.html#promos'].map(href=>({href,attributes:{},getAttribute:()=>href,setAttribute(name,value){this.attributes[name]=value;}}));
      location.pathname=pathname;layoutController();
      assert.deepEqual(links.filter(link=>link.attributes['aria-current']==='page').map(link=>link.href),[expected],pathname);
    }
  }finally{restore();}
});

test('inicio registra recuperación antes de leer productos y no bloquea campañas tras fallo inicial',async()=>{
  const listeners={},watchers=[],timeline=[],target={innerHTML:'',textContent:'',addEventListener(name){listeners[name]=(listeners[name]||0)+1;},querySelectorAll:()=>[]};
  const notes={textContent:''};let attempts=0,promotions=0;
  const restore=globals({staticUrlHome:{
    featured:async()=>{timeline.push('products');if(++attempts===1)throw new Error('Servidor temporalmente disponible después.');return [product()];},
    promotions:async()=>{promotions++;return [];},
    watch(refresh){timeline.push('watch');const update=async()=>{try{await refresh();}catch(_){}};watchers.push(update);return update;},
  },document:{getElementById:id=>id==='featured-products'?target:notes},sessionStorage:{getItem:()=>null}});
  try{
    const {homeController}=await load('frontend/controllers/catalog.js',{
      '../config.js':configStub,
      '../models/catalog.js':'export const catalog={featured:()=>globalThis.staticUrlHome.featured(),promotions:()=>globalThis.staticUrlHome.promotions()};',
      '../models/cart.js':'export const cart={};',
      '../views/products.js':'export const catalogView=(items,target)=>{target.innerHTML=items.map(item=>item.nombre).join();},productView=()=>{},promotionView=()=>{},comparisonView=()=>{};',
      '../views/common.js':'export const message=()=>{},busy=()=>{};',
      './updates.js':'export const watchUpdates=refresh=>globalThis.staticUrlHome.watch(refresh),preserveFocus=(target,render)=>render();',
    });
    await assert.doesNotReject(homeController());await new Promise(resolve=>setImmediate(resolve));
    assert.equal(timeline[0],'watch');assert.equal(watchers.length,2);assert.equal(promotions,1);assert.ok(target.textContent);
    await watchers[0]();assert.equal(target.innerHTML,'Producto');assert.equal(attempts,2);
    assert.deepEqual(listeners,{click:1,change:1});
  }finally{restore();}
});
