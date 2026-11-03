const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;

test('laboratorios y presentaciones reales filtran el catálogo y abren una ficha coherente',async({page})=>{
  const response=await page.request.get('/api/productos/filtros');expect(response.status()).toBe(200);const facets=(await response.json()).data;
  expect(facets.laboratorios.length).toBeGreaterThanOrEqual(5);expect(facets.presentaciones.length).toBeGreaterThanOrEqual(10);
  await page.goto('/catalogo.html');await expect(page.locator('#catalog-laboratory')).toBeVisible();await expect(page.locator('#catalog-presentation')).toBeVisible();
  await page.locator('#catalog-laboratory').selectOption('Beiersdorf AG');await expect(page.locator('#catalog-grid article')).toHaveCount(2);await expect(page.locator('#catalog-grid')).toContainText('Eucerin');await expect(page.locator('#catalog-grid')).toContainText('NIVEA');
  const item=await page.request.get('/api/productos/solar');const product=(await item.json()).data;
  await page.locator('#catalog-presentation').selectOption(product.presentacion);await expect(page.locator('#catalog-grid article')).toHaveCount(1);await page.locator('#catalog-grid h3 a').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#product-detail')).toContainText('Beiersdorf AG');await expect(page.locator('#product-detail')).toContainText(product.presentacion);await expect(page.locator('#detail-add-button')).toBeEnabled();
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
});

test('las fotografías caben completas en sus tarjetas sin recortar el envase',async({page})=>{
  await page.goto('/catalogo.html');await expect(page.locator('#catalog-grid article').first()).toBeVisible();
  for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    const images=await page.locator('#catalog-grid .featured-image img').evaluateAll(nodes=>nodes.map(image=>{const box=image.getBoundingClientRect(),parent=image.parentElement.getBoundingClientRect();return {alt:image.alt,inside:box.height<=parent.height+1&&box.width<=parent.width+1,fit:getComputedStyle(image).objectFit};}));
    expect(images.filter(image=>!image.inside),'Fotos completas a '+width).toEqual([]);expect(images.every(image=>image.fit==='contain')).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
