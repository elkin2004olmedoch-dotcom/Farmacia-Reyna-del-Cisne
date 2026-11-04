const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default,{randomUUID}=require('node:crypto');
async function place(request,user,products){
 const response=await request.post('/api/pedidos',{headers:{Authorization:'Bearer '+user.token},data:{claveSolicitud:randomUUID(),carrito:products.map(product=>({productoId:product.id,cantidad:1})),comprador:{name:user.usuario.nombre,email:user.usuario.email,phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:'pickup'}}});expect(response.status()).toBe(201);return (await response.json()).data;
}
async function fixture(page,request,{lines=1}={}){
 const signed=(await (await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}})).json()).data;
 const headers={Authorization:'Bearer '+signed.token};
 const register=async(nombre='Cliente Cancelación')=>{const result=await request.post('/api/auth/register',{data:{nombre,email:randomUUID()+'@example.ec',telefono:'0991234567',cedula:'0102030400',password:'CancelacionPrueba2026!'}});expect(result.status()).toBe(201);return (await result.json()).data;};
 const user=await register(),products=[];
 for(let n=0;n<lines;n++){const response=await request.post('/api/productos',{headers,data:{nombre:'Cuidado cancelación '+n+' '+randomUUID().slice(0,8),precio:11.5,stock:10,categoria:'cuidado',descripcion:'Producto sintético para probar cancelación',imagen:'assets/images/producto-vitaminas.jpg',alt:'Producto de cuidado personal',tipoProducto:'cuidado',ivaCategoria:'general',requiereReceta:false}});expect(response.status()).toBe(201);products.push((await response.json()).data);}
 const order=await place(request,user,products);
 await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),user.token);await page.goto('/pedidos.html');await expect(page.locator('.order-card')).toHaveCount(1);
 const writes=[];page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/cancelacion'))writes.push(r);});
 return {user,headers,order,products,register,writes};
}
async function accessible(page){expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);}
test('cancelar modal conserva pedido y foco; aceptar restaura stock y muestra comprobante único',async({page,request},testInfo)=>{
 const data=await fixture(page,request,{lines:9}),button=page.locator('[data-order-cancel]'),dialog=page.locator('#confirm-dialog');
 await expect(button).toHaveCount(1);await expect(page.locator('[data-order-receipt]')).toHaveCount(1);await expect(page.locator('[data-order-invoice]')).toHaveCount(0);
 const bounds=await button.boundingBox(),firstLine=await page.locator('.purchase-order-line').first().boundingBox();expect(bounds.y).toBeLessThan(firstLine.y);
 await button.focus();await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await accessible(page);await page.screenshot({path:testInfo.outputPath('cancelar-pedido-modal.png'),fullPage:true});
 await page.keyboard.press('Escape');await expect(button).toBeFocused();expect(data.writes).toHaveLength(0);await expect(page.locator('.order-state-label')).toContainText('Pendiente');
 await page.keyboard.press('Enter');await dialog.locator('[value=cancel]').click();await expect(button).toBeFocused();expect(data.writes).toHaveLength(0);
 await page.keyboard.press('Enter');const changed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/cancelacion'));await dialog.locator('[value=confirm]').click();expect((await changed).status()).toBe(200);
 await expect(page.locator('.order-state-label')).toContainText('Cancelado');await expect(button).toHaveCount(0);await expect(page.locator('#order-title-'+data.order.id)).toBeFocused();await expect(page.locator('#page-status')).toContainText('Pedido cancelado');expect(data.writes).toHaveLength(1);
 expect((await (await request.get('/api/productos/'+data.products[0].id)).json()).data.stock).toBe(10);
 await accessible(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('pedido-cancelado.png'),fullPage:true});
});
test('preparación durante confirmación devuelve409, actualiza el pedido y retira cancelación',async({page,request})=>{
 const data=await fixture(page,request);let order=data.order;
 await page.locator('[data-order-cancel]').click();
 for(const estado of ['confirmado','preparado']){const response=await request.put('/api/pedidos/'+order.id+'/estado',{headers:data.headers,data:{estado,esperadoUpdatedAt:order.updatedAt}});expect(response.status()).toBe(200);order=(await response.json()).data;}
 const rejected=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/cancelacion'));await page.locator('#confirm-dialog [value=confirm]').click();expect((await rejected).status()).toBe(409);
 await expect(page.locator('.order-state-label')).toContainText('Preparado');await expect(page.locator('[data-order-cancel]')).toHaveCount(0);await expect(page.locator('#page-status')).toContainText('cambió');await expect(page.locator('#order-title-'+order.id)).toBeFocused();
 expect((await (await request.get('/api/productos/'+data.products[0].id)).json()).data.stock).toBe(9);
});
test('otra cuenta en la cookie durante el modal impide escribir y retira datos anteriores',async({page,request},testInfo)=>{
 const data=await fixture(page,request);await page.locator('[data-order-cancel]').click();const other=await data.register('Segunda Cuenta'),otherOrder=await place(request,other,data.products);
 const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+other.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);
 await page.locator('#confirm-dialog [value=confirm]').click();await expect(page.locator('#page-status')).toContainText('sesión cambió');await expect(page.locator('.order-card')).toHaveCount(0);expect(data.writes).toHaveLength(0);
 await expect(page.locator('#account-menu-toggle')).toHaveAttribute('aria-label','Abrir menú de Segunda Cuenta');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('#order-title-'+otherOrder.id)).toBeVisible();await expect(page.locator('#order-title-'+data.order.id)).toHaveCount(0);
 await page.locator('#account-menu-toggle').click();await expect(page.locator('.account-menu-identity strong')).toHaveText('Segunda Cuenta');await page.screenshot({path:testInfo.outputPath('sesion-cambiada-cabecera-pedidos.png')});await page.keyboard.press('Escape');
 const mine=await request.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+data.user.token}});expect((await mine.json()).data.items[0].estado).toBe('pendiente');
});
test('cambio de cuenta por señal sincroniza cabecera antes de mostrar pedidos nuevos',async({page,request})=>{
 const data=await fixture(page,request),other=await data.register('Otra Compradora'),otherOrder=await place(request,other,data.products);
 const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+other.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);
 await page.evaluate(()=>{window.dispatchEvent(new StorageEvent('storage',{key:'farmacia-session-change',newValue:'sin-secretos'}));window.dispatchEvent(new Event('focus'));});
 await expect(page.locator('#order-title-'+otherOrder.id)).toBeVisible();await expect(page.locator('#order-title-'+data.order.id)).toHaveCount(0);await expect(page.locator('#account-menu-toggle')).toHaveAttribute('aria-label','Abrir menú de Otra Compradora');expect(data.writes).toHaveLength(0);
});
test('señal de sesión mientras confirma invalida la acción aunque la cuenta siga siendo la misma',async({page,request})=>{
 const data=await fixture(page,request);await page.locator('[data-order-cancel]').click();
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'farmacia-session-change',newValue:'sin-secretos'})));
 await page.locator('#confirm-dialog [value=confirm]').click();await expect(page.locator('#page-status')).toContainText('sesión cambió');expect(data.writes).toHaveLength(0);
});
test('comprobante conserva correo registrado, impresión y foco sin controles SRI/XML',async({page,request},testInfo)=>{
 const data=await fixture(page,request),button=page.locator('[data-order-receipt]');await expect(button).toHaveCount(1);await expect(page.locator('[data-order-invoice]')).toHaveCount(0);
 await button.click();const receipt=page.locator('.order-receipt-dialog');await expect(receipt).toContainText('Comprobante del pedido');await expect(receipt).toContainText(/sin validez tributaria/i);
 await page.locator('[data-receipt-email]').click();await expect(page.locator('[data-receipt-email-status]')).toContainText('todavía no está habilitado');
 await page.evaluate(()=>{window.cancelPrints=0;window.print=()=>window.cancelPrints++;});await page.locator('[data-receipt-print]').click();expect(await page.evaluate(()=>window.cancelPrints)).toBe(1);await expect(page.locator('.order-receipt-print-root')).toHaveCount(1);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await accessible(page);await page.screenshot({path:testInfo.outputPath('comprobante-unico.png')});await page.locator('[data-receipt-close]').click();await expect(button).toBeFocused();await expect(page.locator('[data-reorder]')).toHaveCount(1);expect(data.writes).toHaveLength(0);
});
