const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');
test.use({serviceWorkers:'block'});
async function send(pet,text){await pet.locator('#input').fill(text);await pet.locator('#form button[type=submit]').click();}
async function login(page,email='admin-browser@example.ec',password='AdminBrowser2026!'){
  await page.goto('/cuenta.html');await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await page.locator('#login-form button[type=submit]').click();await expect(page).toHaveURL(email.startsWith('admin')?/admin.html$/:/cuenta.html$/);
}
async function createProduct(page){
  await login(page);const response=await page.request.post('/api/productos',{headers:{Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{nombre:'Gel tarjeta '+randomUUID().slice(0,8),precio:8,stock:15,categoria:'cuidado',descripcion:'Producto sintético de las tarjetas de Goti.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético',presentacion:'Frasco de 100 ml',tipoProducto:'cuidado',ivaCategoria:'general'}});
  expect(response.status()).toBe(201);return (await response.json()).data;
}
test('Goti muestra producto real y carrito vigente, confirma sin comprar, teclado accesible a 320 px',async({page,browser})=>{
  const product=await createProduct(page),context=await browser.newContext({viewport:{width:320,height:900}}),client=await context.newPage(),errors=[];client.on('pageerror',error=>errors.push(error.message));
  try{
    await client.goto('/catalogo.html');const pet=client.locator('farmacia-mascota');await pet.locator('#launcher').click();
    const searches=[];client.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/productos')searches.push(url);});
    await send(pet,'buscar '+product.nombre);let card=pet.locator('.companion-card').last();await expect(card).toContainText(product.nombre);await expect(card).toContainText('Frasco de 100 ml');
    await expect(card.locator('img')).toHaveAttribute('src',product.imagen);await expect(card.locator('img')).toHaveAttribute('loading','lazy');await expect(card.getByRole('link')).toHaveAttribute('href','producto.html?id='+product.id);
    expect(searches.some(url=>url.searchParams.get('pageSize')==='8')).toBe(true);expect(searches.some(url=>url.searchParams.get('pageSize')==='100')).toBe(false);
    await pet.getByLabel('Cantidad',{exact:true}).fill('2');await pet.getByRole('button',{name:'Revisar antes de confirmar'}).click();await pet.getByRole('button',{name:'Sí, confirmar'}).focus();await client.keyboard.press('Enter');
    await expect(pet.locator('#messages')).toContainText('Añadido: 2');await client.getByRole('button',{name:'Cerrar carrito',exact:true}).click();await send(pet,'mi carrito');await expect(pet.locator('.companion-cards').last()).toContainText('Subtotal de productos');await expect(pet.locator('#messages')).toContainText('envío se confirma en el checkout');
    expect(new URL(client.url()).pathname).toBe('/catalogo.html');
    expect(await pet.locator('#panel').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
    expect((await new AxeBuilder({page:client}).include('farmacia-mascota').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);expect(errors).toEqual([]);
  }finally{await context.close();}
});
test('fotos rotas y nombres hostiles conservan tarjetas de texto y Goti animada',async({page})=>{
  await page.route('**/api/productos?*',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('pageSize')!=='8')return route.continue();await route.fulfill({json:{ok:true,data:{items:[{id:'gel-tarjeta-xss',nombre:'<img src=x onerror=alert(1)> '+'nombre'.repeat(35),precio:null,stock:1,activo:true,imagen:'assets/images/no-existe.jpg',presentacion:'<script>alert(1)</script>',alt:'Envase de prueba'}],page:1,pageSize:8,total:1}}});});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/catalogo.html');const pet=page.locator('farmacia-mascota');await pet.locator('#launcher').click();await send(pet,'buscar gel');
  const card=pet.locator('.companion-card').last();await expect(card).toContainText('<img src=x onerror=alert(1)>');await expect(card).toContainText('Precio por confirmar');await expect(card.locator('img')).toHaveAttribute('src','assets/images/producto-sin-imagen.svg');await expect(card.locator('script')).toHaveCount(0);
  const before=await page.evaluate(()=>FarmaciaMascota.getStatus());await expect.poll(()=>page.evaluate(()=>FarmaciaMascota.getStatus().frame)).not.toBe(before.frame);expect(errors).toEqual([]);
});
test('Ver registro aparece después de guardar, permanece al conversar y localiza fila exacta',async({page})=>{
  const product=await createProduct(page),pet=page.locator('farmacia-admin-companion');await pet.locator('#launcher').click();await send(pet,`modifica producto "id:${product.id}": precio=9`);
  await expect(pet.getByRole('link',{name:'Ver registro'})).toHaveCount(0);await pet.getByRole('button',{name:'Sí, confirmar'}).click();const link=pet.getByRole('link',{name:'Ver registro'});await expect(link).toHaveAttribute('href','admin.html?tabla=productos&registro='+product.id);
  await send(pet,'ayuda');await expect(link).toBeVisible();await link.click();await expect(page).toHaveURL(new RegExp('admin.html\\?tabla=productos&registro='+product.id));
  const row=page.locator('[data-companion-record="'+product.id+'"]');await expect(row).toContainText(product.nombre);await expect(row).toBeFocused();
});
test('invitado recibe acceso a cuenta y nunca consulta pedidos administrativos',async({page})=>{
  const privateReads=[];page.on('request',request=>{if(/\/api\/(?:pedidos|admin)/.test(new URL(request.url()).pathname))privateReads.push(request.url());});
  await page.goto('/catalogo.html');const pet=page.locator('farmacia-mascota');await pet.locator('#launcher').click();await send(pet,'mis pedidos');await expect(pet.getByRole('link',{name:'Abrir mi cuenta'})).toHaveAttribute('href','cuenta.html');await expect(pet.locator('.companion-order')).toHaveCount(0);expect(privateReads).toEqual([]);
});
test('pedido propio usa precio histórico y foto, enlaza seguimiento y borra resumen privado al expirar sesión',async({page,request,browser})=>{
  const product=await createProduct(page),email='tarjetas-'+randomUUID().slice(0,8)+'@example.ec';
  const registration=await request.post('/api/auth/register',{data:{nombre:'Cliente Tarjetas',email,telefono:'0991234567',cedula:'0102030400',password:'TarjetasPrueba2026!'}});expect(registration.status()).toBe(201);const saved=(await registration.json()).data;
  const orderResponse=await request.post('/api/pedidos',{headers:{Authorization:'Bearer '+saved.token},data:{carrito:[{productoId:product.id,cantidad:2}],comprador:{name:'Cliente Tarjetas',email,phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''},claveSolicitud:randomUUID()}});expect(orderResponse.status()).toBe(201);const order=(await orderResponse.json()).data;
  const context=await browser.newContext(),client=await context.newPage();
  try{
    await client.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),saved.token);await client.goto('/catalogo.html');const pet=client.locator('farmacia-mascota');await pet.locator('#launcher').click();await send(pet,'último pedido');const summary=pet.locator('.companion-order');await expect(summary).toContainText(product.nombre);await expect(summary).toContainText('Pendiente');await expect(summary.locator('img')).toHaveAttribute('src',product.imagen);await expect(summary.getByRole('link',{name:'Seguir mi pedido'})).toHaveAttribute('href','seguimiento.html?pedido='+order.id);await expect(summary).not.toContainText(email);await expect(summary).not.toContainText('0991234567');
    await client.evaluate(async()=>{const {events}=await import('/models/events.js');events.dispatchEvent(new Event('session:expired'));});await expect(pet.locator('.companion-order')).toHaveCount(0);await expect(pet.locator('a[href^="seguimiento.html?"]')).toHaveCount(0);
  }finally{await context.close();}
});
test('Ver registro de zona abre el detalle autorizado exacto y enfoca su resumen',async({page})=>{
  await login(page);const response=await page.request.post('/api/admin/zonas-entrega',{headers:{Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{nombre:'Zona Tarjetas '+randomUUID().slice(0,8),provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:100,ivaCategoria:'general',fundamentoIva:null,activa:true}});expect(response.status()).toBe(201);const zone=(await response.json()).data;
  const pet=page.locator('farmacia-admin-companion');await pet.locator('#launcher').click();await send(pet,`modifica zona "${zone.id}": tarifaCentavos=175`);await pet.getByRole('button',{name:'Sí, confirmar'}).click();await pet.getByRole('link',{name:'Ver registro'}).click();
  await expect(page).toHaveURL(new RegExp('admin.html\\?tabla=zonas&registro='+zone.id));const detail=page.locator('[data-companion-record="'+zone.id+'"]');await expect(detail).toContainText(zone.nombre);await expect(detail).toContainText('1.75');await expect(detail).toBeFocused();await expect(detail.getByRole('link',{name:'Gestionar entregas y cobertura'})).toHaveAttribute('href','entregas.html');
});
