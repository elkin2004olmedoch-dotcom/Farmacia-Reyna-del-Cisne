async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ctx = await page.context().browser().newContext({ viewport:{width:375,height:900}, serviceWorkers:'block' });
  const p = await ctx.newPage();
  try {
    await p.goto('http://localhost:4173/');
    await p.locator('.promotion-card').first().waitFor();
    check(await p.locator('.promotion-card').count()===2, 'Se muestran las campañas de ejemplo.');
    check((await p.locator('#promotions-note').innerText()).includes('no anuncian descuentos vigentes'),'La vista previa no promete descuentos reales.');
    check(await p.locator('.business-photo img').evaluate(img=>img.complete && img.naturalWidth>0),'La fachada se carga.');
    await p.locator('.promotion-card a').first().click();
    await p.locator('#detail-add-form').waitFor();
    check(new URL(p.url()).searchParams.get('id')==='solar','Campaña enlaza su ficha.');
    await p.route('**/data/promociones.json',route=>route.fulfill({json:[]}));
    await p.goto('http://localhost:4173/');
    await p.locator('.promotions-empty').waitFor();
    check(await p.locator('.promotion-card').count()===0,'Sin campañas, se muestra el estado vacío.');
    await p.unroute('**/data/promociones.json');
    await p.route('**/data/promociones.json',route=>route.abort());
    await p.reload(); await p.locator('.promotion-card').first().waitFor();
    check(await p.locator('.promotion-card').count()===2,'La copia local funciona sin acceso a los datos.');
    return 'Fachada, campañas, enlace, estado vacío y respaldo local: OK';
  } finally { await ctx.close(); }
}
