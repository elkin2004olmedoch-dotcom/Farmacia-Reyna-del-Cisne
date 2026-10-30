const {test,expect}=require('@playwright/test');

test('el resumen ajusta un nombre válido sin espacios y conserva su importe dentro del panel móvil',async({page})=>{
  const id='81045b3e-f0c9-4e28-9269-57db344494aa',nombre='Producto'.repeat(15);
  const user={id:'0bba25d2-02a7-409b-b7de-dd3f0549eca7',nombre:'Cliente Resumen',email:'resumen@example.ec',telefono:'0979275988',role:'user',activo:true,createdAt:'2026-10-29T12:00:00.000Z'};
  const dto={pedido:{id,estado:'pendiente',createdAt:'2026-10-29T12:00:00.000Z',total:25.5,totalCentavos:2550,subtotalCentavos:2550,costoEnvioCentavos:0,ivaCentavos:333,moneda:'USD',detalles:[{nombreProducto:nombre,cantidad:1,totalCentavos:2550}]},pago:null,payphone:{disponible:false,entorno:null},demostracion:true};
  await page.addInitScript(()=>sessionStorage.setItem('farmacia-mvc-token','sesion-sintetica-resumen'));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{ok:true,data:user}});
    if(path==='/api/pedidos/'+id+'/pago')return route.fulfill({json:{ok:true,data:dto}});
    return route.fulfill({status:404,json:{ok:false,error:{message:'Ruta fuera de esta prueba de presentación.'}}});
  });
  await page.goto('/pagos.html?pedido='+id);
  await expect(page.locator('.payment-lines li')).toHaveCount(1);
  await expect(page.locator('.payment-lines li>span')).toContainText(nombre);
  await expect(page.locator('.payment-lines li>strong')).toContainText(/25[,.]50/);
  for(const width of [320,375])await test.step('nombre e importe visibles a '+width+' px',async()=>{
    await page.setViewportSize({width,height:900});
    const geometry=await page.locator('.payment-summary').evaluate(summary=>{
      const box=element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,height:rect.height};};
      return {summary:box(summary),viewport:innerWidth,lines:[...summary.querySelectorAll('.payment-lines li')].map(row=>{
        const name=row.querySelector('span'),range=document.createRange();range.selectNodeContents(name);
        return {row:box(row),name:box(name),amount:box(row.querySelector('strong')),text:[...range.getClientRects()].map(rect=>({left:rect.left,right:rect.right})),lineHeight:parseFloat(getComputedStyle(name).lineHeight)};
      })};
    });
    for(const line of geometry.lines){
      for(const [label,box]of Object.entries({fila:line.row,nombre:line.name,importe:line.amount})){
        expect.soft(box.left,label+' empieza dentro del resumen a '+width).toBeGreaterThanOrEqual(Math.max(0,geometry.summary.left)-1);
        expect.soft(box.right,label+' termina dentro del resumen a '+width).toBeLessThanOrEqual(Math.min(geometry.viewport,geometry.summary.right)+1);
      }
      for(const rect of line.text)expect.soft(rect.right,'el texto completo se ajusta sin recortes a '+width).toBeLessThanOrEqual(Math.min(geometry.viewport,geometry.summary.right)+1);
      expect.soft(line.name.height,'el nombre se distribuye en varias líneas a '+width).toBeGreaterThan(line.lineHeight*1.5);
    }
  });
});
