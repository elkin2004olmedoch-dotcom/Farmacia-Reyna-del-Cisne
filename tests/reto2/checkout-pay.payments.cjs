const {test,expect}=require('@playwright/test'),{randomUUID}=require('node:crypto');
async function setup(page,request){
 const suffix=randomUUID(),email='pagoprimero-'+suffix+'@example.ec',user=(await (await request.post('/api/auth/register',{data:{nombre:'Cliente Pago',email,telefono:'0991234567',cedula:'0102030400',password:'PagoPrimero2026!'}})).json()).data;
 await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+user.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});
 const catalog=(await (await request.get('/api/productos?page=1&pageSize=100')).json()).data,product=catalog.items.find(p=>p.tipoProducto==='cuidado'&&p.stock>0&&!p.requiereReceta);
 await page.goto('/producto.html?id='+product.id);await page.locator('#detail-add-button').click();await expect(page.getByRole('button',{name:'Carrito, 1 unidades',exact:true})).toBeVisible();await page.goto('/checkout.html');await page.locator('#checkout-next').click();await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-terms').check();return user;
}
test('tarjeta se revisa antes del pedido; cancelar no compra; confirmar genera pedido y pago juntos',async({page,request},testInfo)=>{
 const user=await setup(page,request);let writes=[];page.on('request',req=>{if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/pedidos')writes.push(req.postDataJSON());});
 await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#payment-card-dialog')).toBeVisible();expect(writes).toEqual([]);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();expect(writes).toEqual([]);await page.getByRole('button',{name:'Agregar tarjeta'}).click();
 await page.getByLabel('Número de tarjeta',{exact:true}).fill('4111111111111111');await page.getByLabel('Vencimiento MM/AA').fill('1230');await page.locator('#payment-card-cvv').fill('123');await page.getByLabel('Titular de la tarjeta',{exact:true}).fill('Cliente Sintético');await page.getByRole('button',{name:'Usar esta tarjeta'}).click();
 await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#confirm-dialog')).toBeVisible();expect(writes).toEqual([]);await page.locator('#confirm-dialog [value=confirm]').click();
 await expect(page.locator('#order-confirmation')).toBeVisible();expect(writes).toHaveLength(1);expect(writes[0].pago).toEqual({metodo:'card',marca:'visa'});expect(JSON.stringify(writes)).not.toContain('411111');await expect(page.locator('#order-confirmation')).toContainText('Completado · Sin cobro real');await expect(page.getByRole('link',{name:'Elegir forma de pago'})).toHaveCount(0);
 const orders=(await (await request.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+user.token}})).json()).data;expect(orders.total).toBe(1);expect(orders.items[0].pagoPractica.metodo).toBe('card');await page.screenshot({path:testInfo.outputPath('compra-pagada.png'),fullPage:true});
});
test('transferencia confirma el total y selección automática prefiere zona local sobre nacional',async({page,request})=>{
 await setup(page,request);await page.locator('#checkout-delivery').check();await page.locator('#checkout-province').selectOption('Azuay');await page.locator('#checkout-city').fill('Cuenca');await page.locator('#checkout-city').blur();await expect(page.locator('#checkout-zone')).toHaveValue('ecuador-nacional');
 await page.locator('#checkout-province').selectOption('Pichincha');await page.locator('#checkout-city').fill('Puerto Quito');await page.locator('#checkout-city').blur();await expect(page.locator('#checkout-zone')).toHaveValue('puerto-quito');
 await page.locator('#checkout-pickup').check();await page.locator('[name=paymentPreference][value=transfer]').check();await expect(page.locator('#checkout-payment-fields')).toBeHidden();await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#confirm-dialog')).toContainText('Transferencia');await page.locator('#confirm-dialog [value=confirm]').click();await expect(page.locator('#order-confirmation')).toBeVisible();
});
