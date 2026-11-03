const {test,expect}=require('./browser-fixture.cjs');
test('ubicación usa el pin del titular; mapa bajo demanda, teclado y colores coherentes',async({page},info)=>{
 let maps=0;await page.route('https://www.google.com/maps**',route=>{maps++;return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Mapa sintético</title><p>Proveedor externo sustituido en pruebas.</p></html>'});});
 await page.goto('/');const location=page.locator('#ubicacion'),frame=location.locator('iframe');
 await expect(location.locator('.location-copy')).toContainText('Consulab');await expect(frame).not.toHaveAttribute('src');expect(maps).toBe(0);
 await location.locator('summary').focus();await page.keyboard.press('Enter');
 await expect(frame).toHaveAttribute('src',/q=0\.1200092%2C-79\.2580379/);await expect(frame).toHaveAttribute('title',/Farmacia Reina del Cisne/);
 const href=await location.locator('a[target="_blank"]').getAttribute('href');expect(new URL(href).searchParams.get('query')).toBe('0.1200092,-79.2580379');
 await location.locator('summary').focus();await page.keyboard.press('Enter');await expect(frame).not.toHaveAttribute('src');
 await page.getByRole('link',{name:'Visítanos',exact:true}).click();await expect(location).toHaveAttribute('open','');await expect(frame).toHaveAttribute('src',/0\.1200092/);
 await location.locator('summary').focus();await page.keyboard.press('Enter');await expect(frame).not.toHaveAttribute('src');
 await page.getByRole('link',{name:'Visítanos',exact:true}).click();await expect(location).toHaveAttribute('open','');await expect(frame).toHaveAttribute('src',/0\.1200092/);
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#681e2a');
 const manifest=await page.request.get('/store.webmanifest');expect((await manifest.json()).theme_color).toBe('#681e2a');
 expect(await page.locator('#inicio').evaluate(n=>getComputedStyle(n).backgroundColor)).toBe('rgb(104, 30, 42)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:info.outputPath('ubicacion-paleta.png'),fullPage:true});
});
