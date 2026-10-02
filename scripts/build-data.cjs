const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(root, 'data/productos.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'data/productos-local.js'), '// Copia generada de productos.json para apertura directa sin servidor.\n(globalThis.Farmacia ||= {}).localProducts = ' + JSON.stringify(products, null, 2) + ';\n');
console.log('Copia local del catálogo actualizada.');
