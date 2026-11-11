const {test,expect,apiToken}=require('./browser-fixture.cjs');

const resources=[
  {section:'promociones',path:'/api/promociones',readPath:'/api/admin/promociones',form:'promotion-form',field:'titulo',input:'promotion-titulo',code:'PROMOTION_CHANGED',values:{titulo:'Promoción de versión',etiqueta:'Prueba',descripcion:'Contenido sintético para comprobar versiones',productoId:'solar',descuentoPorcentaje:0,activa:false,vistaPrevia:true,orden:0,inicio:null,fin:null}},
  {section:'proveedores',path:'/api/admin/proveedores',form:'supplier-form',field:'nombre',input:'supplier-nombre',code:'SUPPLIER_CHANGED',values:{nombre:'Proveedor de versión',ruc:'0102030418001',email:'proveedor-version@example.ec',telefono:'0991234567',direccion:'Calle Sintética 123 frente al parque',activo:true}},
];

for(const resource of resources)test(`el formulario de ${resource.section} conserva su versión y rechaza sobrescribir otra edición`,async({page,request,baseURL})=>{
  const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');
  const headers={Authorization:'Bearer '+token};
  const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{...headers,Origin:new URL(baseURL).origin,'X-Farmacia-Web':'1'},data:{}});
  expect(exchanged.status()).toBe(200);
  const created=await request.post(resource.path,{headers,data:resource.values});
  expect(created.status()).toBe(201);
  const record=(await created.json()).data;
  await page.goto('/admin.html?tabla='+resource.section+'&registro='+record.id);
  await page.locator('[data-edit="'+record.id+'"]').click();
  await expect(page.locator('#'+resource.input)).toHaveValue(resource.values[resource.field]);
  const localValue='Edición local del formulario';
  await page.locator('#'+resource.input).fill(localValue);
  const endpoint=resource.path+'/'+record.id;
  const readEndpoint=(resource.readPath||resource.path)+'/'+record.id;
  const fresh=await request.get(readEndpoint,{headers});
  expect(fresh.status()).toBe(200);
  const current=(await fresh.json()).data;
  const remoteValue='Edición guardada desde otra sesión';
  const remote=await request.put(endpoint,{headers,data:{...resource.values,[resource.field]:remoteValue,esperadoUpdatedAt:current.updatedAt}});
  expect(remote.status()).toBe(200);
  const remoteRecord=(await remote.json()).data;
  expect(remoteRecord.updatedAt).not.toBe(record.updatedAt);
  const response=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname===endpoint);
  await page.locator('#'+resource.form+' [type=submit]').click();
  const rejected=await response;
  expect(rejected.status()).toBe(409);
  expect(rejected.request().postDataJSON().esperadoUpdatedAt).toBe(record.updatedAt);
  expect((await rejected.json()).error.code).toBe(resource.code);
  await expect(page.locator('#editor-dialog')).toBeVisible();
  await expect(page.locator('#editor-status')).toContainText('cambió');
  await expect(page.locator('#'+resource.input)).toHaveValue(localValue);
  const persisted=await request.get(readEndpoint,{headers});
  expect(persisted.status()).toBe(200);
  const saved=(await persisted.json()).data;
  expect(saved[resource.field]).toBe(remoteValue);
  expect(saved.updatedAt).toBe(remoteRecord.updatedAt);
});
