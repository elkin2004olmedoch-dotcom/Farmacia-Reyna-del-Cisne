const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4fGkRVsQwtCQAJ4yZwRji18kAAAAASUVORK5CYII=','base64');
const currency=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(value);
const isoEcuador=value=>new Date(value.getTime()-5*3600000).toISOString().slice(0,16);
async function login(page){
  await page.goto('/cuenta.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(/admin.html$/);
}
async function accessible(page,label){const issues=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(issues.map(item=>({id:item.id,target:item.nodes.map(node=>node.target)})),label).toEqual([]);}
async function findRow(page,text){
  const row=page.locator('#admin-table tbody tr').filter({hasText:text});
  while(!await row.count()){const next=page.locator('#admin-next');if(!await next.isEnabled())break;await next.click();await expect(page.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');}
  await expect(row).toHaveCount(1);return row;
}
function syntheticRuc(project){const digits=project==='movil'?'010203042':'010203041';const sum=[...digits].reduce((n,d,i)=>{let v=Number(d)*(i%2?1:2);return n+(v>9?v-9:v);},0);return digits+(10-sum%10)%10+'001';}

test('descuento directo hasta 85 %, IVA 0 % documentado y ficha farmacéutica se guardan desde el panel',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await login(page);
  await page.goto('/admin.html?tabla=productos');await expect(page.locator('#admin-create')).toBeEnabled();
  await page.locator('#admin-create').focus();await page.keyboard.press('Enter');await expect(page.locator('#editor-dialog')).toBeVisible();
  await page.locator('#product-form [type=submit]').click();await expect(page.locator('#product-nombre')).toBeFocused();await expect(page.locator('#product-nombre')).toHaveAttribute('aria-invalid','true');
  const name='Farmacéutico '+testInfo.project.name+' '+Date.now();
  for(const [key,value] of Object.entries({nombre:name,precio:'23.00',pvpMaximo:'23.00',stock:'5',descripcion:'Producto sintético para comprobar impuestos y descuentos',alt:'Envase de prueba',descuentoPorcentaje:'86',codigoInterno:'PRUEBA-'+testInfo.project.name,codigoBarras:'4006381333931',laboratorio:'Laboratorio de prueba',principioActivo:'Principio activo de prueba',concentracion:'500 mg',presentacion:'Caja de 20 tabletas',registroSanitario:'REGISTRO-PRUEBA',stockMinimo:'2'}))await page.locator('#product-'+key).fill(value);
  await page.locator('#product-tipoProducto').selectOption('medicamento');await page.locator('#product-ivaCategoria').selectOption('cero');
  await page.locator('#product-image-file').setInputFiles({name:'farmacia-prueba.png',mimeType:'image/png',buffer:tinyPNG});await expect(page.locator('#product-form [type=submit]')).toBeEnabled();
  await page.locator('#product-form [type=submit]').click();await expect(page.locator('#product-descuentoPorcentaje')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#product-descuentoPorcentaje')).toBeFocused();await expect(page.locator('#product-fundamentoIva')).toHaveAttribute('aria-invalid','true');
  await page.locator('#product-descuentoPorcentaje').fill('85');await page.locator('#product-fundamentoIva').fill('Artículo 55 de la LRTI: clasificación de prueba, únicamente en la base temporal de tests.');
  await page.locator('#product-pvpMaximo').fill('20.00');await page.locator('#product-form [type=submit]').click();await expect(page.locator('#product-precio')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#product-precio')).toBeFocused();await expect(page.locator('#product-precio-error')).toContainText('PVP');await page.locator('#product-pvpMaximo').fill('23.00');
  await page.locator('#product-laboratorio').fill('');await page.locator('#product-form [type=submit]').click();await expect(page.locator('#product-laboratorio')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#product-laboratorio')).toBeFocused();await page.locator('#product-laboratorio').fill('Laboratorio de prueba');
  await accessible(page,'Editor de producto con descuento, IVA y ficha farmacéutica');
  const response=page.waitForResponse(res=>res.request().method()==='POST' && new URL(res.url()).pathname==='/api/productos');await page.locator('#product-form [type=submit]').click();const saved=await response;expect(saved.status()).toBe(201);const product=(await saved.json()).data;await expect(page.locator('#editor-dialog')).toBeHidden();
  const publicResponse=await page.request.get('/api/productos/'+product.id);expect(publicResponse.status()).toBe(200);const publicProduct=(await publicResponse.json()).data;
  expect(publicProduct.descuentoPorcentaje).toBe(85);expect(Number(publicProduct.precio)).toBe(3.45);expect(Number(publicProduct.pvpMaximo)).toBe(23);expect(publicProduct.ivaCategoria).toBe('cero');expect(publicProduct.tipoProducto).toBe('medicamento');expect(publicProduct.codigoBarras).toBe('4006381333931');
  const row=await findRow(page,name);await row.locator('[data-edit]').click();await expect(page.locator('#product-descuentoPorcentaje')).toHaveValue('85');await expect(page.locator('#product-fundamentoIva')).toHaveValue(/Artículo 55/);await expect(page.locator('#product-ivaCategoria')).toHaveValue('cero');await expect(page.locator('#product-stockMinimo')).toHaveValue('2');
  await page.keyboard.press('Escape');await expect(page.locator('#editor-dialog')).toBeHidden();await expect(row.locator('[data-edit]')).toBeFocused();
  await page.goto('/producto.html?id='+product.id);await expect(page.locator('.detail-price')).toContainText(currency(3.45));await expect(page.locator('.promotion-ribbon')).toContainText('85%');expect(errors).toEqual([]);
});

test('proveedores ecuatorianos, lotes y movimientos comparten stock con clientes',async({page},testInfo)=>{
  await login(page);await page.goto('/admin.html?tabla=proveedores');await expect(page.locator('#admin-create')).toBeEnabled();await page.locator('#admin-create').click();
  const suffix=testInfo.project.name+' '+Date.now();const supplierName='Proveedor de prueba '+suffix;
  for(const [key,value] of Object.entries({nombre:supplierName,ruc:'0000000000000',email:'correo inválido',telefono:'1111',direccion:'Av. Amazonas N10-20, Quito'}))await page.locator('#supplier-'+key).fill(value);
  await page.locator('#supplier-form [type=submit]').click();await expect(page.locator('#supplier-ruc')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#supplier-email')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#supplier-telefono')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#supplier-ruc')).toBeFocused();
  await page.locator('#supplier-ruc').fill(syntheticRuc(testInfo.project.name));await page.locator('#supplier-email').fill('proveedor-'+testInfo.project.name+'@example.ec');await page.locator('#supplier-telefono').fill('+593979275988');
  await accessible(page,'Proveedor con validación ecuatoriana');const supplierResponse=page.waitForResponse(res=>res.request().method()==='POST' && new URL(res.url()).pathname==='/api/admin/proveedores');await page.locator('#supplier-form [type=submit]').click();expect((await supplierResponse).status()).toBe(201);await expect(page.locator('#editor-dialog')).toBeHidden();
  const supplierRow=page.locator('#admin-table tbody tr').filter({hasText:supplierName});await expect(supplierRow.locator('[data-delete]')).toHaveCount(0);
  await page.goto('/admin.html?tabla=lotes');await expect(page.locator('#admin-create')).toBeEnabled();await page.locator('#admin-create').click();await page.locator('#lot-productoId').selectOption('solar');await page.locator('#lot-proveedorId').selectOption({label:supplierName});
  const beforeResponse=await page.request.get('/api/productos/solar');const before=(await beforeResponse.json()).data;
  await page.locator('#lot-numero').fill('LOTE-'+suffix);await page.locator('#lot-cantidad').fill('3');await page.locator('#lot-costoUnitario').fill('4.25');await page.locator('#lot-vencimiento').fill('2020-01-01');await page.locator('#lot-form [type=submit]').click();await expect(page.locator('#lot-vencimiento')).toHaveAttribute('aria-invalid','true');
  await page.locator('#lot-vencimiento').fill(new Date(Date.now()+365*86400000).toISOString().slice(0,10));const lotResponse=page.waitForResponse(res=>res.request().method()==='POST' && new URL(res.url()).pathname==='/api/admin/lotes');await page.locator('#lot-form [type=submit]').click();const savedLot=await lotResponse;expect(savedLot.status()).toBe(201);const lot=(await savedLot.json()).data;await expect(page.locator('#editor-dialog')).toBeHidden();
  expect((await (await page.request.get('/api/productos/solar')).json()).data.stock).toBe(before.stock+3);
  await page.goto('/admin.html?tabla=movimientos');await expect(page.locator('#admin-create')).toBeEnabled();await page.locator('#admin-create').focus();await page.keyboard.press('Enter');await page.locator('#movement-productoId').selectOption('solar');await expect(page.locator('#movement-loteId')).toBeEnabled();await page.locator('#movement-loteId').selectOption(lot.id);await page.locator('#movement-tipo').selectOption('salida');await page.locator('#movement-cantidad').fill('1');await page.locator('#movement-motivo').fill('Salida de una unidad por comprobación en tests');
  const movementResponse=page.waitForResponse(res=>res.request().method()==='POST' && new URL(res.url()).pathname==='/api/admin/inventario/ajustes');await page.locator('#movement-form [type=submit]').click();expect((await movementResponse).status()).toBe(201);await expect(page.locator('#editor-dialog')).toBeHidden();expect((await (await page.request.get('/api/productos/solar')).json()).data.stock).toBe(before.stock+2);await expect(page.locator('#admin-table')).toContainText('Salida de una unidad por comprobación');
});

test('tarifas de IVA con vigencia de Ecuador, historial accesible y teclado en 320, 768 y 1920 px',async({page},testInfo)=>{
  await login(page);await page.goto('/admin.html?tabla=fiscal');await expect(page.locator('#fiscal-form')).toBeVisible();await expect(page.locator('#admin-records')).toBeHidden();
  await page.locator('#fiscal-form [type=submit]').click();await expect(page.locator('#fiscal-inicioVigencia')).toBeFocused();await expect(page.locator('#fiscal-referenciaNormativa')).toHaveAttribute('aria-invalid','true');
  const future=new Date(Date.now()+((testInfo.project.name==='movil'?365:364)*86400000));await page.locator('#fiscal-tarifaGeneral').selectOption('13');await page.locator('#fiscal-inicioVigencia').fill(isoEcuador(future));await page.locator('#fiscal-referenciaNormativa').fill('Norma sintética de test: únicamente se almacena en la base temporal de pruebas.');
  const fiscalResponse=page.waitForResponse(res=>res.request().method()==='POST' && new URL(res.url()).pathname==='/api/admin/configuracion/fiscal');await page.locator('#fiscal-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=confirm]').focus();await page.keyboard.press('Enter');const saved=await fiscalResponse;expect(saved.status()).toBe(201);const tariff=(await saved.json()).data;
  expect(tariff.tarifaGeneral).toBe(13);expect(Date.parse(tariff.inicioVigencia)).toBe(Date.parse(isoEcuador(future)+'-05:00'));await expect(page.locator('.admin-fiscal-history')).toContainText('Norma sintética de test');await accessible(page,'IVA e historial');
  for(const width of [320,768,1920]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'IVA sin desbordamiento a '+width).toBe(false);}
  await page.setViewportSize({width:testInfo.project.name==='movil'?375:1920,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/pruebas/reto2/capturas/admin-fiscal-'+testInfo.project.name+'.png',fullPage:true});
  await page.goto('/admin.html?tabla=productos');await expect(page.locator('#admin-create')).toBeEnabled();await page.locator('#admin-create').focus();await page.keyboard.press('Space');await expect(page.locator('#editor-dialog')).toBeVisible();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(page.locator('#product-nombre')).toBeFocused();
  for(const width of [320,768,1920]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Editor sin desbordamiento a '+width).toBe(false);}
  await page.keyboard.press('Escape');await expect(page.locator('#admin-create')).toBeFocused();
});
