const {test,expect,apiToken}=require('./browser-fixture.cjs');
const {Prisma}=require('../../server/models/prisma-client.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
async function adminPage(page,request,table){const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),token);await page.goto('/admin.html?tabla='+table);await expect(page.locator('#admin-area')).toBeVisible();return token;}

test('la vista completa permite consultar cada modelo sin enlaces operativos y conserva la tabla al recargar',async({page,request})=>{
  const token=await adminPage(page,request,'datos&vista=completa');
  const response=await request.get('/api/admin/recursos',{headers:{Authorization:'Bearer '+token}});
  const resources=(await response.json()).data;
  const select=page.getByLabel('Tabla de datos',{exact:true});
  await expect(select.locator('option')).toHaveCount(Prisma.dmmf.datamodel.models.length);
  for(const resource of resources){
    await select.selectOption(resource.key);
    await expect(page.locator('#admin-resource-title')).toHaveText(resource.label);
    await expect(page.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');
    await expect(page.locator('#admin-table caption,#admin-table .shop-empty')).toBeVisible();
    await expect(page.locator('#admin-resource-actions a')).toHaveCount(0);
  }
  await page.reload();
  await expect(select).toHaveValue(resources.at(-1).key);
  await expect(select.locator('option')).toHaveCount(resources.length);
});

test('el administrador consulta los recursos habituales y conserva la selección y paginación en la URL',async({page,request})=>{
  const token=await adminPage(page,request,'datos');
  const response=await request.get('/api/admin/recursos',{headers:{Authorization:'Bearer '+token}});expect(response.status()).toBe(200);
  const resources=(await response.json()).data;
  expect(resources.map(resource=>resource.model).sort()).toEqual(Prisma.dmmf.datamodel.models.map(model=>model.name).sort());
  const visibleResources=resources.filter(item=>!['configuracion-emisor','secuencias-factura','facturas','entregas','sesiones-moviles','incidencias-entrega'].includes(item.key));
  const select=page.getByLabel('Tabla de datos',{exact:true});await expect(select.locator('option')).toHaveCount(visibleResources.length);
  for(const resource of visibleResources){
    const loaded=page.waitForResponse(response=>response.url().includes('/api/admin/tablas?')&&new URL(response.url()).searchParams.get('tabla')===resource.key);
    await select.selectOption(resource.key);const response=await loaded;expect(response.status()).toBe(200);expect((await response.json()).data.resource.model).toBe(resource.model);
    await expect(page.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#admin-table caption,#admin-table .shop-empty')).toBeVisible();await expect(page.locator('#admin-resource-title')).toHaveText(resource.label);await expect(page).toHaveURL(new RegExp('recurso='+resource.key+'(?:&|$)'));await expect(page.locator('#admin-create')).toBeHidden();
  }
  await page.reload();await expect(select).toHaveValue(visibleResources.at(-1).key);
  await expect(page.locator('#admin-table')).not.toContainText('passwordHash');await expect(page.locator('#admin-table')).not.toContainText('secretHash');
  const products=page.waitForResponse(response=>response.url().includes('/api/admin/tablas?tabla=productos'));
  await select.selectOption('productos');const data=(await(await products).json()).data;
  if(process.env.PHARMACY_BROWSER_EXPANDED_CATALOG==='true')expect(data.total).toBe(66);
  if(data.total>20){await page.locator('#admin-next').click();await expect(page.locator('#admin-page-info')).toContainText('Página 2');await expect(page).toHaveURL(/recurso=productos&page=2/);await page.reload();await expect(select).toHaveValue('productos');await expect(page.locator('#admin-page-info')).toContainText('Página 2');}
  if(test.info().project.name==='movil')await page.setViewportSize({width:320,height:900});
  const selectBox=await select.boundingBox(),cardBox=await page.locator('#admin-resource-controls').boundingBox();
  expect(selectBox.height).toBeGreaterThanOrEqual(44);expect(selectBox.width).toBeLessThanOrEqual(cardBox.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const accessibility=await new AxeBuilder({page}).analyze();expect(accessibility.violations.filter(item=>['serious','critical'].includes(item.impact))).toEqual([]);
  await page.screenshot({path:test.info().outputPath('configuracion-datos.png'),fullPage:true});
});

test('usuarios se crean y editan en el navegador con control de versión y datos conservados ante conflicto',async({page,request})=>{
  const token=await adminPage(page,request,'usuarios'),headers={Authorization:'Bearer '+token};
  await page.locator('#admin-create').click();const form=page.locator('#user-form');await expect(form).toBeVisible();
  const username='alumno_'+test.info().project.name;
  await form.getByLabel('Nombre completo',{exact:true}).fill('Persona de Prueba');await form.getByLabel('Usuario (opcional)',{exact:true}).fill(username);await form.getByLabel('Correo electrónico',{exact:true}).fill(username+'@example.ec');await form.getByLabel('Teléfono',{exact:true}).fill('0991234567');await form.getByLabel('Contraseña',{exact:true}).fill('UsuarioPrueba2026!');await form.getByRole('button',{name:'Guardar usuario',exact:true}).click();
  await expect(page.locator('#editor-dialog')).toBeHidden();const row=page.locator('#admin-table tr').filter({hasText:username});await expect(row).toHaveCount(1);await row.getByRole('button',{name:/Editar/}).click();
  await form.getByLabel('Nombre completo',{exact:true}).fill('Edición conservada');const before=await request.get('/api/admin/usuarios/'+await row.locator('[data-edit]').getAttribute('data-edit'),{headers});expect(before.status()).toBe(200);const user=(await before.json()).data;
  const update=await request.put('/api/admin/usuarios/'+user.id,{headers,data:{nombre:'Cambio concurrente',username:user.username,email:user.email,telefono:user.telefono,role:user.role,activo:user.activo,esperadoUpdatedAt:user.updatedAt}});expect(update.status()).toBe(200);
  const conflict=page.waitForResponse(response=>response.url().endsWith('/api/admin/usuarios/'+user.id)&&response.request().method()==='PUT');await form.getByRole('button',{name:'Guardar usuario',exact:true}).click();expect((await conflict).status()).toBe(409);await expect(form.getByLabel('Nombre completo',{exact:true})).toHaveValue('Edición conservada');await expect(page.locator('#editor-status')).not.toBeEmpty();
  const actual=(await(await request.get('/api/admin/usuarios/'+user.id,{headers})).json()).data;expect(actual.nombre).toBe('Cambio concurrente');
});
