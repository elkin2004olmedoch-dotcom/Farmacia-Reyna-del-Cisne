async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const results=[];
  const base='http://localhost:4173/';
  for(const width of [1440,375]) {
    const ctx=await page.context().browser().newContext({viewport:{width,height:900},serviceWorkers:'block'});
    const p=await ctx.newPage(); const failures=[];
    p.on('pageerror',error=>failures.push(error.message));
    try {
      await p.goto(base+'index.html'); await p.locator('#featured-products article').first().waitFor();
      await p.evaluate(()=>document.fonts.ready);
      await p.screenshot({path:`.playwright-mcp/qa-home-${width}.png`,fullPage:true});
      await p.locator('#global-search').fill('solar'); await p.locator('.header-search [type=submit]').click();
      await p.waitForFunction(()=>document.querySelector('#catalog-search')?.value==='solar');
      check(await p.locator('.catalog-card').count()===1,'La búsqueda de cabecera debe filtrar el catálogo.');
      await p.locator('#catalog-clear').click();
      check(await p.locator('.catalog-card').count()===18,'Restablecer conserva los 18 productos publicados.');
      await p.locator('#filter-bienestar').click();
      check(await p.locator('.catalog-card').count()===14,'Categoría bienestar muestra sus 14 productos.');
      await p.locator('#catalog-clear').click();
      await p.locator('.catalog-add[data-product-id=solar]').click();
      check(await p.locator('[data-shop-count]').innerText()==='1','Añadir actualiza el contador de cabecera.');
      await p.screenshot({path:`.playwright-mcp/qa-catalog-${width}.png`,fullPage:true});
      await p.goto(base+'producto.html?id=vitaminas'); await p.locator('#detail-add-form').waitFor();
      await p.locator('#detail-quantity').fill('2'); await p.locator('#detail-add-form [type=submit]').click();
      check(await p.locator('#added-dialog').evaluate(el=>el.open),'La ficha muestra confirmación de añadido.');
      await p.keyboard.press('Escape');
      await p.locator('#review-form [type=submit]').click();
      check(await p.locator('#review-name').getAttribute('aria-invalid')==='true','Opiniones vacías muestran errores.');
      await p.locator('#review-name').fill('Cliente Prueba'); await p.locator('#review-rating').selectOption('4'); await p.locator('#review-message').fill('Buena experiencia de prueba del catálogo.'); await p.locator('#review-form [type=submit]').click();
      check(await p.locator('.review-item').count()===1,'Se guarda una opinión local.');
      await p.screenshot({path:`.playwright-mcp/qa-product-${width}.png`,fullPage:true});
      await p.goto(base+'comparar.html'); await p.locator('.comparison-table').waitFor();
      check(await p.locator('.comparison-table thead th').count()===5,'La comparación incluye los 4 productos.');
      await p.screenshot({path:`.playwright-mcp/qa-compare-${width}.png`,fullPage:true});
      await p.goto(base+'cuenta.html'); await p.locator('#show-register').click();
      await p.locator('#register-form [type=submit]').click();
      check(await p.locator('#register-cedula').getAttribute('aria-invalid')==='true','Registro valida cédula obligatoria.');
      const profile={name:'Cliente',surname:'Prueba',email:`cliente${width}@example.ec`,phone:'0979275988',cedula:'0102030400',password:'Prueba123',confirm:'Prueba123'};
      for(const [key,value] of Object.entries(profile)) await p.locator(`#register-${key}`).fill(value);
      await p.locator('#register-terms').check(); await p.locator('#register-form [type=submit]').click();
      await p.locator('#logout').waitFor(); check((await p.locator('#account-area').innerText()).includes('Hola, Cliente'),'Registro inicia sesión.');
      await p.locator('#logout').click(); await p.locator('#login-form').waitFor();
      await p.locator('#login-email').fill(profile.email); await p.locator('#login-password').fill('Incorrecta1'); await p.locator('#login-form [type=submit]').click();
      await p.waitForFunction(()=>document.getElementById('login-status').textContent.includes('no coinciden'));
      await p.locator('#login-password').fill('Prueba123'); await p.locator('#login-form [type=submit]').click(); await p.locator('#logout').waitFor();
      await p.goto(base+'checkout.html'); await p.locator('.checkout-cart-item').first().waitFor();
      check(await p.locator('.checkout-cart-item').count()===2,'Se conserva el carrito entre páginas y acceso.');
      await p.locator('[data-order-remove=solar]').click(); await p.keyboard.press('Escape');
      check(await p.locator('.checkout-cart-item').count()===2,'Escape cancela quitar.');
      await p.locator('#checkout-next').click(); await p.locator('#delivery-form [type=submit]').click();
      check(await p.locator('#checkout-document').getAttribute('aria-invalid')==='true','Compra exige documento válido.');
      await p.locator('#checkout-document').fill('0102030400');
      await p.locator('input[name=delivery][value=delivery]').check();
      await p.locator('#delivery-form [type=submit]').click();
      check(await p.locator('#checkout-province').getAttribute('aria-invalid')==='true','Entrega exige provincia.');
      await p.locator('#checkout-province').selectOption('Pichincha'); await p.locator('#checkout-city').fill('Quito'); await p.locator('#checkout-address').fill('Av. Amazonas N10-20, cerca del parque'); await p.locator('#checkout-postalCode').fill('170101');
      await p.screenshot({path:`.playwright-mcp/qa-delivery-${width}.png`,fullPage:true});
      await p.locator('#delivery-form [type=submit]').click(); await p.locator('input[name=payment][value=card]').check();
      await p.locator('#payment-form [type=submit]').click();
      check(await p.locator('#payment-cardNumber').getAttribute('aria-invalid')==='true','Pago valida tarjeta antes de registrar.');
      await p.locator('#fill-test-card').click(); await p.locator('#payment-terms').check();
      await p.screenshot({path:`.playwright-mcp/qa-payment-${width}.png`,fullPage:true});
      await p.locator('#payment-form [type=submit]').click(); await p.locator('#order-confirmation .confirmation-check').waitFor();
      check((await p.locator('#order-confirmation').innerText()).includes('No se realizó ningún cobro'),'Confirmación explica simulación.');
      check(await p.locator('[data-shop-count]').innerText()==='0','El pedido vacía el carrito.');
      const stored=await p.evaluate(()=>localStorage.getItem('farmacia-shop-orders'));
      for(const value of ['4000002180000000','4000 0021 8000 0000','0102030400','"cvv"','"expiry"']) check(!stored.includes(value),'No se conserva '+value);
      await p.screenshot({path:`.playwright-mcp/qa-confirmation-${width}.png`,fullPage:true});
      await p.goto(base+'pedidos.html'); await p.locator('.order-card').waitFor();
      check(await p.locator('.order-card').count()===1,'El historial recupera el pedido.');
      const link=decodeURIComponent(await p.locator('.order-card a[target=_blank]').getAttribute('href'));
      check(link.includes('WhatsApp')===false && link.includes('confirmen disponibilidad'),'El mensaje solicita confirmación a la farmacia.');
      check(!link.includes('0102030400')&&!link.includes('4000002180000000'),'WhatsApp no incluye documentos o tarjetas.');
      for(const file of ['index.html','catalogo.html','producto.html?id=solar','comparar.html','cuenta.html','checkout.html','pedidos.html','ayuda.html']) {
        await p.goto(base+file); await p.waitForTimeout(100);
        const horizontal=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1}));
        check(!horizontal.overflow,`${file} no debe desbordarse a ${width}px (ancho real ${horizontal.width}).`);
      }
      check(!failures.length,'Sin errores JS: '+failures.join(', '));
      results.push({width,checks:'Búsqueda, filtros, carrito, opiniones, comparación, registro, acceso, validación, compra, privacidad, historial y 8 páginas sin desbordamiento: OK'});
    } finally { await ctx.close(); }
  }
  return results;
}
