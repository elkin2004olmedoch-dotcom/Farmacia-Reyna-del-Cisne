const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
test.use({serviceWorkers:'block'});
async function setup(page,method='card'){
 const user={id:'practice-user',nombre:'Cliente Práctica',email:'practice@example.ec',telefono:'0991234567',role:'user',activo:true,emailVerifiedAt:'2026-11-02T12:00:00Z'};
 const data={pedido:{id:'practice-order',estado:'pendiente',totalCentavos:1150,subtotalCentavos:1150,costoEnvioCentavos:0,ivaCentavos:150,detalles:[{nombreProducto:'Producto de cuidado',cantidad:1,totalCentavos:1150}]},pago:null,payphone:{disponible:false,entorno:null},transferencia:{disponible:true,banco:'Banco Ejemplo',tipo:'ahorros',numeroCuenta:'0123456789',titular:'Titular Sintético'},practica:{disponible:true,resultado:null}},writes=[];
 await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,data:user}}));
 await page.route('**/api/pedidos/practice-order/pago',route=>route.fulfill({json:{ok:true,data}}));
 await page.route('**/api/pedidos/practice-order/pago/practica',route=>{const body=route.request().postDataJSON();writes.push(body);data.practica.resultado={id:'practice-result',pedidoId:'practice-order',metodo:body.metodo,marca:body.marca||null,totalCentavos:1150};return route.fulfill({json:{ok:true,data}});});
 await page.goto('/pagos.html?pedido=practice-order&metodo='+method);await expect(page.locator('#payment-mode')).toHaveText('Sin cobro real');return {data,writes};
}
test('tarjeta reconoce la marca de un número inventado y Pagar completa el recorrido sin transmitirlo',async({page},testInfo)=>{
 const {writes}=await setup(page),number='4111111111111234';await page.getByLabel('Número de tarjeta',{exact:true}).fill(number);await expect(page.locator('#payment-practice-brand')).toHaveText('Visa');
 await expect(page.locator('input[autocomplete="cc-csc"],input[name="cvv"]')).toHaveCount(0);
 await page.locator('#payment-submit').focus();await page.keyboard.press('Enter');await expect(page.locator('#payment-practice-result')).toBeVisible();await expect(page.getByRole('heading',{name:'Pago completado'})).toBeVisible();await expect(page.locator('#payment-practice-result')).toContainText('Sin cobro real');await expect(page.locator('#payment-practice-number')).toHaveValue('');
 expect(writes).toEqual([{metodo:'card',marca:'visa'}]);await page.locator('#payment-form').dispatchEvent('submit');expect(writes).toHaveLength(1);
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(stored).not.toContain(number);expect(page.url()).not.toContain(number);
 await page.reload();await expect(page.locator('#payment-practice-result')).toBeVisible();await expect(page.locator('#payment-form')).toBeHidden();
 await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.screenshot({path:testInfo.outputPath('pago-completado.png'),fullPage:true});
});
test('una marca no reconocida no envía solicitud y permite corregir el número',async({page})=>{
 const {writes}=await setup(page);await page.getByLabel('Número de tarjeta',{exact:true}).fill('1234567890123456');await page.getByRole('button',{name:'Pagar',exact:true}).click();await expect(page.locator('#payment-error-message')).toContainText('marca reconocidas');expect(writes).toEqual([]);await expect(page.locator('#payment-practice-result')).toBeHidden();
 await page.getByLabel('Número de tarjeta',{exact:true}).fill('5100000000001234');await expect(page.locator('#payment-practice-brand')).toHaveText('Mastercard');
 await page.locator('input[value="transfer"]').check();await page.locator('input[value="card"]').check();await expect(page.getByLabel('Número de tarjeta',{exact:true})).toHaveValue('');await expect(page.locator('#payment-practice-brand')).toHaveText('Marca por identificar');
});
test('transferencia muestra Pagar y completa sin pedir una transferencia real ni datos de tarjeta',async({page})=>{
 const {writes}=await setup(page,'transfer');await expect(page.locator('#payment-practice-card')).toBeHidden();await expect(page.locator('#payment-transfer-intro')).toContainText('No realices una transferencia bancaria');await page.getByRole('button',{name:'Pagar',exact:true}).click();await expect(page.locator('#payment-practice-result')).toBeVisible();expect(writes).toEqual([{metodo:'transfer'}]);await expect(page.locator('#payment-practice-summary')).toContainText('Transferencia');await expect(page.locator('#payment-persisted-state')).toContainText('No se ha realizado un cobro');
});
test('formulario de práctica conserva contraste, etiquetas, teclado y ancho móvil',async({page})=>{
 await setup(page);const input=page.getByLabel('Número de tarjeta',{exact:true});await input.focus();await page.keyboard.type('340000000001234');await expect(page.locator('#payment-practice-brand')).toHaveText('American Express');
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(issue=>issue.id)).toEqual([]);
});
