const fs = require('node:fs');
const data = JSON.parse(fs.readFileSync('data/promociones.json','utf8'));
if (!Array.isArray(data)) throw new Error('Las promociones deben ser una lista.');
fs.writeFileSync('data/promociones-local.js', `// Copia generada desde promociones.json para apertura directa.\n(globalThis.Farmacia ||= {}).localPromotions = ${JSON.stringify(data,null,2)};\n`);
