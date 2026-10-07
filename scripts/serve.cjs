const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf' };
http.createServer((req,res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html')); }
  catch (_) { res.writeHead(400); return res.end('Solicitud inválida'); }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Sin acceso'); }
  fs.readFile(file,(error,data)=> { if(error) { res.writeHead(404); return res.end('No encontrado'); } res.writeHead(200,{ 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(data); });
}).listen(4173,'127.0.0.1',()=>process.stdout.write('Farmacia: http://127.0.0.1:4173\n'));
