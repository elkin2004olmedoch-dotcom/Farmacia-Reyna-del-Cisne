const {test,expect,apiToken}=require('./browser-fixture.cjs');
test('un cambio desde otra sesión llega al catálogo visible sin recargar ni compartir almacenamiento',async({page,request},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!'),headers={Authorization:'Bearer '+token};
 let product=(await (await request.get('/api/productos?pageSize=24')).json()).data.items.find(item=>item.tipoProducto==='cuidado');
 await page.goto('/catalogo.html');await expect(page.locator('#catalog-grid h3').filter({hasText:product.nombre})).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>new URL(entry.name).pathname==='/controllers/updates.js'))).toBe(true);
 const samples=[];
 for(let index=0;index<3;index++){
  const name='Cuidado sincronizado '+index,started=Date.now();
  const response=await request.patch('/api/productos/'+product.id,{headers,data:{nombre:name,esperadoUpdatedAt:product.updatedAt}});expect(response.status()).toBe(200);product=(await response.json()).data;
  await expect(page.locator('#catalog-grid h3').filter({hasText:name})).toHaveCount(1,{timeout:7000});samples.push(Date.now()-started);
 }
 expect(samples.every(ms=>ms<7000)).toBe(true);expect(errors).toEqual([]);
 await testInfo.attach('latencia-catalogo.json',{body:Buffer.from(JSON.stringify({environment:'API y SQLite temporales, navegador visible, escrituras independientes del documento',samplesMs:samples})),contentType:'application/json'});
 await page.screenshot({path:testInfo.outputPath('catalogo-sincronizado.png'),fullPage:false});
});
