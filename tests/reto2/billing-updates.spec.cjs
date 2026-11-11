const {test,expect}=require('./browser-fixture.cjs');
const {emitter}=require('./sri-fixture.cjs');

test('cerrar la confirmación con una actualización pendiente conserva foco y una sola solicitud de emisión',async({page})=>{
  const invoice={id:'a5226bcb-9787-4f8f-9bdb-27eedc0c02eb',pedidoId:'b5226bcb-9787-4f8f-9bdb-27eedc0c02eb',ambiente:'1',estado:'BORRADOR',total:11.5,xmlDisponible:false};
  let releaseList,releaseEmission,holding=false,emissions=0,listStarted,emissionStarted;
  const listGate=new Promise(resolve=>releaseList=resolve),emissionGate=new Promise(resolve=>releaseEmission=resolve);
  const listRequested=new Promise(resolve=>listStarted=resolve),emissionRequested=new Promise(resolve=>emissionStarted=resolve);
  await page.addInitScript(()=>{
    window.EventSource=class{
      constructor(){window.billingUpdateSource=this;}
      close(){}
    };
  });
  await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,data:{id:'administrador-sintetico',nombre:'Administrador',email:'admin@example.ec',role:'admin',activo:true}}}));
  await page.route('**/api/admin/facturacion/configuracion',route=>route.fulfill({json:{ok:true,data:{...emitter,certificado:{presente:false},capacidades:{opensslDisponible:true}}}}));
  await page.route(url=>url.pathname==='/api/admin/facturacion/facturas',async route=>{
    if(holding){listStarted();await listGate;}
    await route.fulfill({json:{ok:true,data:{items:[invoice],total:1,page:1,pageSize:20}}});
  });
  await page.route('**/api/admin/facturacion/facturas/'+invoice.id+'/emitir',async route=>{
    emissions++;emissionStarted();await emissionGate;
    await route.fulfill({status:409,json:{ok:false,error:{code:'CERTIFICATE_REQUIRED',message:'Carga la firma electrónica del emisor desde administración.'}}});
  });
  try{
    await page.goto('/admin.html?tabla=facturacion');
    await expect(page.locator('#screen-controls')).toBeEnabled();
    const emit=page.locator('[data-invoice-emit="'+invoice.id+'"]');await expect(emit).toBeVisible();
    await page.evaluate(id=>{window.originalInvoiceAction=document.querySelector('[data-invoice-emit="'+id+'"]');},invoice.id);
    await emit.focus();await page.keyboard.press('Enter');await expect(page.locator('#confirm-dialog')).toBeVisible();
    await page.evaluate(()=>{window.billingUpdateSource.onmessage({data:JSON.stringify({revision:'a'.repeat(32)})});});
    holding=true;await page.locator('#confirm-dialog [value=confirm]').focus();await page.keyboard.press('Enter');
    await Promise.all([listRequested,emissionRequested]);releaseList();
    await expect.poll(()=>page.evaluate(()=>window.originalInvoiceAction.isConnected)).toBe(false);
    await expect(emit).toBeDisabled();await emit.focus();await page.keyboard.press('Enter');
    await expect(page.locator('#confirm-dialog')).toBeHidden();expect(emissions).toBe(1);
    releaseEmission();await expect(page.locator('#page-status')).toContainText('firma');await expect(emit).toBeFocused();
    expect(emissions).toBe(1);await expect(page.locator('#billing-table')).toContainText('Borrador');
  }finally{releaseList();releaseEmission();}
});
