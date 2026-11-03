const {test,expect}=require('./browser-fixture.cjs'),AxeBuilder=require('@axe-core/playwright').default;
test.use({serviceWorkers:'block'});
async function setup(page,method='card'){
 const user={id:'practice-user',nombre:'Cliente Práctica',email:'practice@example.ec',telefono:'0991234567',role:'user',activo:true,emailVerifiedAt:'2026-11-02T12:00:00Z'};
 const data={pedido:{id:'practice-order',estado:'pendiente',totalCentavos:1150,subtotalCentavos:1150,costoEnvioCentavos:0,ivaCentavos:150,detalles:[{nombreProducto:'Producto de cuidado',cantidad:1,totalCentavos:1150}]},pago:null,payphone:{disponible:false,entorno:null},transferencia:{disponible:true,banco:'Banco Ejemplo',tipo:'ahorros',numeroCuenta:'0123456789',titular:'Titular Sintético'},practica:{disponible:true,resultado:null}},writes=[];
 await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,data:user}}));
 await page.route('**/api/pedidos/practice-order/pago',route=>route.fulfill({json:{ok:true,data}}));
 await page.route('**/api/pedidos/practice-order/pago/practica',route=>{const body=route.request().postDataJSON();writes.push(body);data.practica.resultado={id:'practice-result',pedidoId:'practice-order',metodo:body.metodo,marca:body.marca||null,totalCentavos:1150};return route.fulfill({json:{ok:true,data}});});
 await page.goto('/pagos.html?pedido=practice-order&metodo='+method);await expect(page.locator('#payment-mode')).toHaveText('Sin cobro real');return {data,writes};
}
async function fillCard(page,{number='4111111111111111',cvv='123'}={}){await page.getByRole('button',{name:/Agregar tarjeta|Cambiar tarjeta/}).click();await page.getByLabel('Número de tarjeta',{exact:true}).fill(number);await page.getByLabel('Vencimiento MM/AA').fill('1230');await page.getByLabel('Código de seguridad',{exact:true}).fill(cvv);await page.getByLabel('Titular de la tarjeta').fill('Cliente Sintético');}
test('agrega tarjeta en ventana, valida formato y paga sin transmitir ni conservar datos sensibles',async({page},testInfo)=>{
 const {writes}=await setup(page),number='4111111111111111';await fillCard(page);await expect(page.locator('#payment-practice-brand')).toHaveText('Visa');
 await page.getByRole('button',{name:'Usar esta tarjeta'}).click();await expect(page.locator('#payment-card-dialog')).not.toBeVisible();await expect(page.locator('#payment-selected-card')).toContainText('Visa •••• 1111');
 await page.locator('#payment-submit').focus();await page.keyboard.press('Enter');await expect(page.locator('#payment-practice-result')).toBeVisible();await expect(page.getByRole('heading',{name:'Pago completado'})).toBeVisible();await expect(page.locator('#payment-practice-result')).toContainText('Sin cobro real');await expect(page.locator('#payment-practice-number')).toHaveValue('');
 expect(writes).toEqual([{metodo:'card',marca:'visa'}]);await page.locator('#payment-form').dispatchEvent('submit');expect(writes).toHaveLength(1);
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(stored).not.toContain(number);expect(page.url()).not.toContain(number);
 await page.reload();await expect(page.locator('#payment-practice-result')).toBeVisible();await expect(page.locator('#payment-form')).toBeHidden();
 await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.screenshot({path:testInfo.outputPath('pago-completado.png'),fullPage:true});
});
test('rechaza Luhn y vencimiento incorrectos; cancelar elimina los datos y devuelve el foco',async({page})=>{
 const {writes}=await setup(page);await fillCard(page,{number:'4111111111111234'});await page.getByRole('button',{name:'Usar esta tarjeta'}).click();await expect(page.locator('#payment-practice-number')).toHaveAttribute('aria-invalid','true');expect(writes).toEqual([]);
 await page.getByLabel('Número de tarjeta',{exact:true}).fill('4111111111111111');await page.getByLabel('Vencimiento MM/AA').fill('0120');await page.getByRole('button',{name:'Usar esta tarjeta'}).click();await expect(page.locator('#payment-card-expiry')).toHaveAttribute('aria-invalid','true');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Agregar tarjeta'})).toBeFocused();await page.getByRole('button',{name:'Agregar tarjeta'}).click();for(const field of ['#payment-practice-number','#payment-card-expiry','#payment-card-cvv','#payment-card-holder'])await expect(page.locator(field)).toHaveValue('');
});
test('transferencia muestra Pagar y completa sin pedir una transferencia real ni datos de tarjeta',async({page})=>{
 const {writes}=await setup(page,'transfer');await expect(page.locator('#payment-practice-card')).toBeHidden();await expect(page.locator('#payment-transfer-intro')).toContainText('No realices una transferencia bancaria');await page.getByRole('button',{name:'Pagar',exact:true}).click();await expect(page.locator('#payment-practice-result')).toBeVisible();expect(writes).toEqual([{metodo:'transfer'}]);await expect(page.locator('#payment-practice-summary')).toContainText('Transferencia');await expect(page.locator('#payment-persisted-state')).toContainText('No se ha realizado un cobro');
});
test('formulario de práctica conserva contraste, etiquetas, teclado y ancho móvil',async({page},testInfo)=>{
 await setup(page);await fillCard(page,{number:'378282246310005',cvv:'1234'});await expect(page.locator('#payment-practice-brand')).toHaveText('American Express');await page.getByRole('button',{name:'Ayuda sobre el código de seguridad'}).click();await expect(page.locator('#payment-cvv-help')).toContainText('4 dígitos');await page.getByRole('button',{name:'Entendido'}).click();
 await page.screenshot({path:testInfo.outputPath('agregar-tarjeta.png'),fullPage:true});
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(issue=>issue.id)).toEqual([]);
});
