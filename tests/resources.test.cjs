const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('JSON y copia para apertura directa contienen el mismo catálogo', () => {
  const json = JSON.parse(fs.readFileSync('data/productos.json', 'utf8'));
  const context = {};
  vm.runInNewContext(fs.readFileSync('data/productos-local.js', 'utf8'), context);
  assert.equal(JSON.stringify(context.Farmacia.localProducts), JSON.stringify(json));
  json.forEach((product) => assert.ok(fs.existsSync(product.image), product.image));
});

test('HTML apunta a scripts, imágenes y estilos locales existentes', () => {
  for (const file of ['index.html', 'catalogo.html', 'producto.html', 'comparar.html', 'cuenta.html', 'checkout.html', 'pedidos.html', 'ayuda.html']) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const reference = match[1].split(/[?#]/)[0];
      if (/^(https?:|tel:|mailto:)/.test(reference)) continue;
      assert.ok(fs.existsSync(path.resolve(reference)), `${file}: ${reference}`);
    }
    assert.ok(html.includes('id="contenido"'));
    assert.ok(html.includes('class="skip-link"'));
  }
});

test('la caché offline incluye las ocho páginas y todos sus recursos locales', () => {
  const context = { self: { addEventListener() {} }, URL };
  vm.runInNewContext(fs.readFileSync('service-worker.js','utf8') + '\nthis.files = APP_FILES;',context);
  for (const file of context.files) assert.ok(fs.existsSync(file),file);
  for (const file of ['index.html','catalogo.html','producto.html','comparar.html','cuenta.html','checkout.html','pedidos.html','ayuda.html','assets/shop.css','js/shop.js','js/commerce.js']) assert.ok(context.files.includes(file),file);
});
