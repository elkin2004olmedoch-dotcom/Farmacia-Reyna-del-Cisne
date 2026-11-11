const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sharp=require('sharp');
const {ids,sections}=require('../../frontend/models/catalog-sections.js');
const root=path.resolve(__dirname,'../..');

test('el catálogo ampliado contiene 48 referencias para consulta con fotografías exactas y fuentes verificables',async()=>{
  const file=path.join(root,'data/catalogo-ampliado.json');
  assert.ok(fs.existsSync(file),'Falta el catálogo ampliado verificado');
  const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
  const sources=JSON.parse(fs.readFileSync(path.join(root,'data/fuentes-catalogo-ampliado.json'),'utf8')).productos;
  assert.equal(catalog.version,'catalogo-secciones-v1');assert.equal(catalog.productos.length,48);assert.equal(sources.length,48);
  assert.equal(new Set(catalog.productos.map(product=>product.id)).size,48);
  for(const id of ids)assert.ok(catalog.productos.filter(product=>product.categoria===id).length>=2,id+': dos referencias como mínimo');
  for(const product of catalog.productos){
    assert.equal(product.soloConsulta,true);assert.equal(product.precio,0);assert.equal(product.stock,0);
    assert.ok(ids.includes(product.categoria));assert.equal(product.requiereReceta,false);
    for(const [field,max] of [['nombre',120],['laboratorio',120],['presentacion',120],['descripcion',500],['alt',250]])assert.ok(typeof product[field]==='string'&&product[field].length>=2&&product[field].length<=max,product.id+': '+field);
    assert.match(product.imagen,/^assets\/images\/producto-catalogo-[a-z0-9-]+\.webp$/);
    const photo=fs.readFileSync(path.join(root,'frontend',product.imagen));
    const source=sources.find(item=>item.id===product.id);assert.ok(source,product.id+': fuente');
    assert.equal(source.nombre,product.nombre);assert.equal(source.presentacion,product.presentacion);assert.equal(source.laboratorio,product.laboratorio);assert.equal(source.imagen,product.imagen);
    for(const field of ['fuenteProducto','fuenteImagen','fuenteEmpresa'])assert.equal(new URL(source[field]).protocol,'https:');
    assert.equal(source.fotoSha256,createHash('sha256').update(photo).digest('hex'));assert.equal(source.fotoBytes,photo.length);assert.ok(photo.length<300*1024);
    const metadata=await sharp(photo).metadata();assert.equal(metadata.format,'webp');assert.ok(metadata.width>=120&&metadata.height>=120&&metadata.width<=720&&metadata.height<=720);
    if(product.tipoProducto==='medicamento'){
      assert.ok(product.registroSanitario);assert.ok(product.principioActivo);assert.ok(product.concentracion);
      assert.equal(source.fuenteClasificacion,'https://www.controlsanitario.gob.ec/wp-content/plugins/download-monitor/download.php?force=1&id=15468');
      assert.equal(product.ivaCategoria,'cero');assert.ok(product.fundamentoIva.length>=8);
    }
  }
  for(const section of sections){assert.ok(section.imagen);assert.ok(fs.existsSync(path.join(root,'frontend',section.imagen)),section.id+': foto de sección');}
});
