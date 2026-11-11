const {test,expect,apiToken}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;

async function administrator(page,request){
  const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');
  const response=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});
  expect(response.status()).toBe(200);
  return {Authorization:'Bearer '+token};
}

test('productos muestra ID, nombre, categoría y PVP con contador y navegación de registros',async({page,request},testInfo)=>{
  const headers=await administrator(page,request);
  let response=await request.get('/api/admin/tablas?tabla=productos&page=1&pageSize=20',{headers});
  const initial=(await response.json()).data;
  for(let index=initial.total;index<=20;index++){
    const created=await request.post('/api/productos',{headers,data:{nombre:'Paginación de prueba '+index,categoria:'cuidado',precio:1.5,stock:2,descripcion:'Producto sintético para comprobar páginas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba'}});
    expect(created.status()).toBe(201);
  }
  response=await request.get('/api/admin/tablas?tabla=productos&page=1&pageSize=20',{headers});
  expect(response.status()).toBe(200);
  const data=(await response.json()).data;
  await page.goto('/admin.html?tabla=productos');
  await expect(page.locator('#admin-table th')).toHaveText(['ID','Nombre','Categoría','PVP','Acciones']);
  await expect(page.locator('#admin-product-total')).toHaveText(data.total+' productos');
  await expect(page.locator('#admin-create')).toHaveText('Nuevo registro');
  await expect(page.locator('#admin-page-info')).toHaveText(`Página 1 de ${Math.max(1,Math.ceil(data.total/20))} · 1–${Math.min(20,data.total)} de ${data.total} registros`);
  const row=page.locator('#admin-table tbody tr').first();
  await expect(row.locator('td').first()).toHaveText(data.items[0].id);
  await expect(row.locator('[data-product-stock]')).toHaveText(String(data.items[0].stock));
  await page.locator('#admin-next').click();
  await expect(page.locator('#admin-page-info')).toContainText('Página 2 de');
  await expect(page).toHaveURL(/tabla=productos&page=2/);
  await page.reload();
  await expect(page.locator('#admin-page-info')).toContainText('Página 2 de');
  await page.locator('#admin-prev').click();
  await expect(page.locator('#admin-page-info')).toContainText('Página 1 de');
  await page.goto('/admin.html?tabla=productos&page=2&registro='+data.items[0].id);
  await expect(page.locator('tr[data-companion-record="'+data.items[0].id+'"]').first()).toContainText(data.items[0].nombre);
  await page.goto('/admin.html?tabla=productos&page=999999');
  await expect(page.locator('#admin-page-info')).toHaveText(`Página 2 de 2 · 21–${data.total} de ${data.total} registros`);
  await expect(page).toHaveURL(/tabla=productos&page=2$/);
  await page.locator('#admin-prev').click();
  await expect(page.locator('#admin-page-info')).toContainText('Página 1 de');
  for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:testInfo.project.name==='movil'?320:1440,height:1000});
  await page.screenshot({path:testInfo.outputPath('productos-con-stock.png'),fullPage:true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('guardar solo cambios usa PATCH con versión y el guardado completo conserva PUT',async({page,request})=>{
  const headers=await administrator(page,request);
  await page.goto('/admin.html?tabla=productos');
  const row=page.locator('#admin-table tbody tr').first();
  await row.locator('[data-edit]').click();
  const name=await page.locator('#product-nombre').inputValue();
  const productId=await row.locator('[data-edit]').getAttribute('data-edit');
  const writes=[];
  page.on('request',request=>{if(new URL(request.url()).pathname==='/api/productos/'+productId && ['PUT','PATCH'].includes(request.method()))writes.push(request);});
  await page.getByRole('button',{name:'Guardar solo cambios',exact:true}).click();
  await expect(page.locator('#editor-status')).toContainText('No hay cambios');
  expect(writes).toHaveLength(0);
  const updatedName=name+' actualizado';
  await page.locator('#product-nombre').fill(updatedName);
  const patchResponse=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname==='/api/productos/'+productId);
  await page.getByRole('button',{name:'Guardar solo cambios',exact:true}).click();
  expect((await patchResponse).status()).toBe(200);
  expect(writes).toHaveLength(1);
  expect(writes[0].postDataJSON()).toEqual({nombre:updatedName,esperadoUpdatedAt:expect.any(String)});
  await expect(page.locator('#editor-dialog')).toBeHidden();
  await page.locator('#admin-table [data-edit="'+productId+'"]').click();
  await page.locator('#product-precio').fill('1.25');
  const putResponse=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/productos/'+productId);
  await page.getByRole('button',{name:'Guardar producto',exact:true}).click();
  expect((await putResponse).status()).toBe(200);
  expect(writes).toHaveLength(2);
  expect(writes[1].postDataJSON()).toMatchObject({nombre:updatedName,precio:1.25,stock:expect.any(Number),descripcion:expect.any(String),esperadoUpdatedAt:expect.any(String)});
  const persisted=await request.get('/api/productos/'+productId,{headers});
  expect((await persisted.json()).data.nombre).toBe(updatedName);
});

test('advertencias opcionales se guardan, aparecen como texto en ficha y pueden retirarse',async({page,request})=>{
  const headers=await administrator(page,request);
  const created=await request.post('/api/productos',{headers,data:{nombre:'Advertencias de prueba',categoria:'cuidado',precio:3.5,stock:4,descripcion:'Registro sintético de pruebas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba'}});
  expect(created.status()).toBe(201);
  const product=(await created.json()).data;
  await page.goto('/admin.html?tabla=productos&registro='+product.id);
  await page.locator('[data-edit="'+product.id+'"]').click();
  await expect(page.locator('#product-advertencias')).toHaveValue('');
  await expect(page.locator('#product-advertencias')).toHaveAttribute('maxlength','1000');
  const warning='Advertencia registrada para esta prueba, consultar la etiqueta del fabricante.';
  await page.locator('#product-advertencias').fill(warning);
  const patchResponse=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname==='/api/productos/'+product.id);
  await page.getByRole('button',{name:'Guardar solo cambios',exact:true}).click();
  const saved=await patchResponse;
  expect(saved.status()).toBe(200);
  expect(saved.request().postDataJSON()).toEqual({advertencias:warning,esperadoUpdatedAt:expect.any(String)});
  await page.goto('/producto.html?id='+product.id);
  await expect(page.locator('.product-warnings')).toContainText(warning);
  await page.goto('/admin.html?tabla=productos&registro='+product.id);
  await page.locator('[data-edit="'+product.id+'"]').click();
  await page.locator('#product-advertencias').fill('');
  const clearedResponse=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname==='/api/productos/'+product.id);
  await page.getByRole('button',{name:'Guardar solo cambios',exact:true}).click();
  const cleared=await clearedResponse;
  expect(cleared.status()).toBe(200);
  expect(cleared.request().postDataJSON()).toEqual({advertencias:null,esperadoUpdatedAt:expect.any(String)});
  await page.goto('/producto.html?id='+product.id);
  await expect(page.locator('#product-title')).toHaveText(product.nombre);
  await expect(page.locator('.product-warnings')).toHaveCount(0);
});
