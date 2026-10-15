const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

async function login(page){
  await page.goto('/cuenta.html');
  await page.locator('#login-email').fill('admin-browser@example.ec');
  await page.locator('#login-password').fill('AdminBrowser2026!');
  await page.locator('#login-form [type=submit]').click();
  await expect(page).toHaveURL(/admin.html$/);
}

test('el asistente local del panel actualiza productos y publica promociones para compradores',async({page,context})=>{
  await login(page);
  const companion=page.locator('farmacia-admin-companion');
  await expect(companion).toHaveCount(1);
  await companion.getByRole('button',{name:'Abrir asistente administrativo'}).click();
  await expect(companion.getByRole('log',{name:'Asistente de administración'})).toContainText('no uso IA externa');
  const issues=(await new AxeBuilder({page}).include('farmacia-admin-companion').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  expect(issues.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);

  const headers={Authorization:'Bearer '+await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))};
  let product,promotion,publicPage;
  try{
    const createdProduct=await page.request.post('/api/productos',{headers,data:{nombre:'Asistente '+randomUUID().slice(0,8),precio:12.5,stock:20,categoria:'cuidado',descripcion:'Producto sintético para probar el asistente administrativo.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de prueba',descuentoPorcentaje:0,ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false}});
    expect(createdProduct.status()).toBe(201);
    product=(await createdProduct.json()).data;
    const price=Number(product.precio)+0.01;
    const stock=product.stock+2;
    const priceResponse=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/productos/'+product.id);
    await companion.locator('#input').fill(`Actualiza el precio de "${product.nombre}" a ${price.toFixed(2)} y el stock a ${stock}`);
    await companion.locator('#form [type=submit]').click();
    expect((await priceResponse).status()).toBe(200);
    await expect(companion.getByRole('log',{name:'Asistente de administración'})).toContainText('Producto actualizado');
    const productAfter=(await (await page.request.get('/api/productos/'+product.id)).json()).data;
    expect(Number(productAfter.precio)).toBe(price);
    expect(productAfter.stock).toBe(stock);

    await page.goto('/admin.html?tabla=promociones');
    await companion.getByRole('button',{name:'Abrir asistente administrativo'}).click();
    await expect(companion.locator('#shortcuts button').first()).toHaveText('Publicar promoción');
    const promotionResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/promociones');
    await companion.locator('#input').fill(`Publica una promoción de 20% para "${productAfter.nombre}" hasta 2030-12-31 titulada "Prueba asistente"`);
    await companion.locator('#form [type=submit]').click();
    const createdPromotionResponse=await promotionResponse;
    expect(createdPromotionResponse.status()).toBe(201);
    promotion=(await createdPromotionResponse.json()).data;
    await expect(companion.getByRole('log',{name:'Asistente de administración'})).toContainText('Promoción publicada');

    publicPage=await context.browser().newPage();
    await publicPage.goto('/producto.html?id='+product.id);
    await expect(publicPage.locator('.promotion-ribbon')).toContainText('20%');
    await publicPage.close();publicPage=null;
    await page.goto('/index.html');
    await expect(page.locator('farmacia-admin-companion')).toHaveCount(0);
    await expect(page.locator('farmacia-mascota')).toHaveCount(0);
  }finally{
    if(publicPage)await publicPage.close();
    if(promotion)await page.request.delete('/api/promociones/'+promotion.id,{headers});
    if(product)await page.request.delete('/api/productos/'+product.id,{headers});
  }
});
