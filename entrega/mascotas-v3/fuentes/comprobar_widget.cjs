/* Isolated store-browser checks: existing frontend, empty catalogue fixtures, real cart events. */
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const frontend=path.resolve(root,'../../frontend');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'");
  if(url.pathname.startsWith('/api/')){
    response.setHeader('Content-Type','application/json');
    const data=url.pathname.includes('productos')?{items:[],total:0,pageSize:100}:[];
    response.end(JSON.stringify({data}));return;
  }
  let target=path.resolve(frontend,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(frontend+path.sep)&&!target.startsWith(root+path.sep)){response.statusCode=403;response.end();return;}
  try{response.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');response.end(fs.readFileSync(target));}catch(_){response.statusCode=404;response.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const csp=[];page.on('console',message=>{if(message.type()==='error' && /Content Security Policy|violates/i.test(message.text()))csp.push(message.text());});
  try{
    await page.goto(origin+'/index.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.FarmaciaMascota?.getStatus().availableStates.length>0);
    assert.equal(await page.locator('farmacia-mascota').count(),1);
    await page.getByRole('button',{name:'¿Te ayudo?'}).click();
    for(const id of ['farmi','boti','goti']){
      await page.getByRole('combobox',{name:'Compañero'}).selectOption(id);
      const status=await page.evaluate(()=>FarmaciaMascota.getStatus());
      assert.equal(status.character,id);assert.equal(status.availableStates.length,9,`${id} has all nine integrated states`);
    }
    await page.getByRole('combobox',{name:'Compañero'}).selectOption('boti');
    await page.getByRole('button',{name:'Horario',exact:true}).click();
    await page.waitForTimeout(1150);
    assert.match(await page.locator('farmacia-mascota .messages').innerText(),/lunes a sábado, de 08:00 a 19:00/);
    assert.equal(await page.getByRole('link',{name:'Hablar con la farmacia ↗'}).last().getAttribute('href'),'https://wa.me/593979275988');
    await page.getByRole('textbox',{name:'¿Qué necesitas?'}).fill('protector solar');
    await page.getByRole('button',{name:'Enviar consulta',exact:true}).click();
    assert.equal(await page.evaluate(()=>FarmaciaMascota.getStatus().state),'running');
    await page.waitForTimeout(1150);
    assert.equal(await page.getByRole('link',{name:'Buscar protector solar',exact:true}).getAttribute('href'),'catalogo.html?q=protector%20solar');
    await page.evaluate(async()=>{const{cart}=await import('/models/cart.js');cart.add({id:'producto-prueba',stock:12,requiereReceta:false},1);});
    assert.equal(await page.evaluate(()=>FarmaciaMascota.getStatus().state),'jumping','reacts to actual store cart signal');
    await page.locator('farmacia-mascota #close').click();
    assert.equal(await page.evaluate(()=>FarmaciaMascota.getStatus().open),false);
    await page.goto(origin+'/catalogo.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.FarmaciaMascota?.getStatus().availableStates.length>0);
    assert.equal(await page.evaluate(()=>FarmaciaMascota.getStatus().character),'boti','persists between store pages');
    await page.getByRole('button',{name:'¿Te ayudo?'}).click();
    await page.getByRole('button',{name:'Mi carrito',exact:true}).click();
    await page.waitForTimeout(1150);
    assert.equal(await page.getByRole('link',{name:'Revisar mi carrito'}).getAttribute('href'),'checkout.html');
    assert.equal(await page.getByRole('link',{name:'Ver mis pedidos'}).getAttribute('href'),'pedidos.html');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>FarmaciaMascota.getStatus().open),false,'Escape closes modeless helper');
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'¿Te ayudo?'}).click();
    const bounds=await page.locator('farmacia-mascota #panel').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844,'widget fits mobile viewport');
    await page.screenshot({path:path.join(root,'previews/widget-tienda-movil.png'),fullPage:false});
    await page.setViewportSize({width:1365,height:900});
    await page.screenshot({path:path.join(root,'previews/widget-tienda-escritorio.png'),fullPage:false});
    assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(csp,[],'works under store Content Security Policy');
    const result={ok:true,checks:['dynamic store initialization','three companions with nine integrated states each','character selection across pages','real cart.add and cart:changed event reaction','thinking before response','correct opening hours','WhatsApp link','catalogue query link','checkout and orders links','close and Escape','mobile bounds','store CSP','no browser errors'],fixture:'Existing frontend and final frontend/assets/mascotas resources. Store catalogue fixture is empty; widget uses its real local module and no mocked widget API. Cart addition runs the real cart model in isolated browser storage.'};
    fs.writeFileSync(path.join(root,'previews/prueba-widget.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
