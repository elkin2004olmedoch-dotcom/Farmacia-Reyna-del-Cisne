async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  for (const width of [1280, 375]) {
    const context = await page.context().browser().newContext({ viewport: { width, height: 900 } });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', error => errors.push(error.message));
    // Solo Tab y teclas de activación: no se fuerza el foco ni se usa el ratón.
    async function tabTo(selector) {
      for (let i = 0; i < 100; i++) {
        if (await p.evaluate(s => document.activeElement?.matches(s), selector)) return;
        await p.keyboard.press('Tab');
      }
      throw new Error(`No se puede alcanzar con Tab: ${selector} (${width}px)`);
    }
    async function activate(selector, key = 'Enter') {
      await tabTo(selector);
      await p.keyboard.press(key);
    }
    const open = id => p.locator(id).evaluate(el => el.open);
    const focused = selector => p.evaluate(s => document.activeElement?.matches(s), selector);
    try {
      await p.goto('http://127.0.0.1:4173/catalogo.html');
      await p.locator('.catalog-add').first().waitFor();
      await p.keyboard.press('Tab');
      check(await focused('.skip-link'), 'El primer Tab debe ofrecer saltar al contenido.');
      await p.keyboard.press('Enter');
      check(await focused('#contenido'), 'El salto debe enfocar el contenido principal.');
      check(!/carrito/i.test(await p.locator('.cart-trigger').innerText()), 'El icono no debe llevar el texto visible Carrito.');
      check(/Carrito/.test(await p.locator('.cart-trigger').getAttribute('aria-label')), 'El icono debe conservar su nombre accesible.');
      await activate('.catalog-add[data-product-id="vitaminas"]');
      await activate('.catalog-add[data-product-id="solar"]', 'Space');
      await activate('.cart-trigger');
      check(await open('#cart-dialog'), 'Enter debe abrir el carrito desde el icono.');
      await activate('[data-product-id="vitaminas"][data-cart-action="increase"]', 'Space');
      check(await p.locator('#quantity-vitaminas').inputValue() === '2', 'Espacio debe aumentar la cantidad.');
      await activate('[data-product-id="vitaminas"][data-cart-action="decrease"]');
      check(await p.locator('#quantity-vitaminas').inputValue() === '1', 'Enter debe reducir la cantidad.');
      await tabTo('#quantity-vitaminas');
      await p.keyboard.press('ControlOrMeta+A');
      await p.keyboard.type('3');
      await p.keyboard.press('Tab');
      check(await p.locator('#quantity-vitaminas').inputValue() === '3', 'La cantidad escrita debe guardarse al salir del campo.');
      check((await p.locator('#cart-total').innerText()).includes('47,25'), 'El total debe reflejar la cantidad escrita.');
      const total = await p.locator('#cart-total').innerText();
      await activate('[data-product-id="vitaminas"][data-cart-action="remove"]');
      check(await open('#cart-remove-dialog'), 'Enter en Quitar debe pedir confirmación.');
      check(await focused('#cart-remove-cancel'), 'Cancelar debe recibir el foco inicial.');
      for (let i = 0; i < 5; i++) {
        await p.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
        check(await p.evaluate(() => !!document.activeElement.closest('#cart-remove-dialog')), 'Tab y Mayús+Tab deben permanecer en la confirmación.');
      }
      await activate('#cart-remove-cancel', 'Space');
      check(await p.locator('.cart-item').count() === 2 && await p.locator('#cart-total').innerText() === total, 'Cancelar debe conservar los productos y el total.');
      check(await focused('[data-product-id="vitaminas"][data-cart-action="remove"]'), 'Cancelar debe devolver el foco a Quitar.');
      await p.keyboard.press('Enter');
      await p.keyboard.press('Escape');
      check(!await open('#cart-remove-dialog') && await open('#cart-dialog'), 'Escape debe cerrar solo la confirmación.');
      check(await p.locator('.cart-item').count() === 2, 'Escape no debe eliminar productos.');
      await p.keyboard.press('Enter');
      await activate('#cart-remove-confirm');
      check(await p.locator('.cart-item').count() === 1, 'Confirmar debe eliminar solo el producto seleccionado.');
      check(await focused('#quantity-solar'), 'Al eliminar, el foco debe pasar al producto siguiente.');
      check((await p.locator('#cart-total').innerText()).includes('9,75'), 'Eliminar debe recalcular el total.');
      await tabTo('#whatsapp-order-link');
      check(/solar/i.test(decodeURIComponent(await p.locator('#whatsapp-order-link').getAttribute('href'))), 'El pedido debe incluir el producto restante.');
      await activate('[data-product-id="solar"][data-cart-action="remove"]', 'Space');
      await activate('#cart-remove-confirm', 'Space');
      check(await focused('#cart-continue'), 'Al eliminar el último producto debe enfocarse Explorar productos.');
      await p.keyboard.press('Escape');
      check(await focused('.cart-trigger'), 'Cerrar debe devolver el foco al icono que abrió el carrito.');
      await activate('#cart-dock [data-open-cart]', 'Space');
      await activate('[data-close-cart]');
      check(await focused('#cart-dock [data-open-cart]'), 'Cerrar con Enter debe devolver el foco al resumen.');
      await tabTo('#catalog-price');
      await p.keyboard.press('Home');
      await p.keyboard.press('ArrowDown');
      await p.keyboard.press('Enter');
      check(await p.locator('.catalog-add').count() === 1, 'El filtro de precio debe funcionar con las flechas.');
      await activate('#catalog-clear');
      await tabTo('#catalog-sort');
      await p.keyboard.press('Home');
      await p.keyboard.press('ArrowDown');
      await p.keyboard.press('Enter');
      check(await p.locator('.catalog-add').first().getAttribute('data-product-id') === 'solar', 'El orden por precio debe funcionar con teclado.');
      await tabTo('#filter-todos');
      await p.keyboard.press('ArrowRight');
      check(await p.locator('#filter-bienestar').getAttribute('aria-selected') === 'true', 'Flecha derecha debe seleccionar Bienestar.');
      await p.keyboard.press('End');
      check(await focused('#filter-bebe'), 'Fin debe enfocar la última categoría.');
      await p.keyboard.press('Home');
      check(await focused('#filter-todos'), 'Inicio debe enfocar la primera categoría.');
      await p.keyboard.press('ArrowLeft');
      check(await focused('#filter-bebe'), 'Flecha izquierda debe recorrer las categorías circularmente.');
      await p.keyboard.press('Home');
      await tabTo('#catalog-search');
      await p.keyboard.type('inexistente');
      check(await p.locator('.catalog-add').count() === 0, 'La búsqueda debe admitir escritura con teclado.');
      await activate('#empty-reset');
      check(await focused('#catalog-search') && await p.locator('.catalog-add').count() === 4, 'Restablecer debe recuperar los productos y el foco.');
      await p.goto('http://127.0.0.1:4173/index.html');
      if (width < 901) {
        await activate('#menu-button', 'Space');
        check(await p.locator('#menu-button').getAttribute('aria-expanded') === 'true', 'Espacio debe abrir el menú móvil.');
        await tabTo('#mobile-nav a[href="catalogo.html"]');
        await p.keyboard.press('Escape');
        check(await focused('#menu-button') && await p.locator('#mobile-nav').isHidden(), 'Escape debe cerrar el menú móvil y devolver el foco.');
      }
      if (await p.locator('.contact-menu summary').isVisible()) {
        await activate('.contact-menu summary', 'Space');
        check(await p.locator('.contact-menu').evaluate(el => el.open), 'Espacio debe desplegar las opciones de contacto.');
        await tabTo('.contact-popover a');
        await activate('.contact-menu summary');
      }
      await activate('.faq-list summary', 'Space');
      check(await p.locator('.faq-list details').first().evaluate(el => el.open), 'Las preguntas frecuentes deben abrirse con Espacio.');
      await activate('#contact-form button[type="submit"]');
      check(await focused('#contact-name') && await p.locator('#form-status a').count() === 4, 'Los errores deben enfocar el primer campo e indicar los cuatro problemas.');
      await activate('#form-status a[href="#contact-email"]');
      check(await focused('#contact-email'), 'Enter en un error debe llevar al campo.');
      for (const [selector, value] of [['#contact-name', 'María Pérez'], ['#contact-email', 'maria@example.com'], ['#contact-phone', '+593 979275988'], ['#contact-message', 'Quiero consultar la disponibilidad del protector solar.']]) {
        await tabTo(selector);
        await p.keyboard.type(value);
      }
      await activate('#contact-form button[type="submit"]', 'Space');
      check(await focused('#contact-whatsapp') && await p.locator('#contact-whatsapp').isVisible(), 'La consulta válida debe enfocar el enlace para continuar.');
      check(errors.length === 0, 'Errores JavaScript: ' + errors.join(', '));
      results.push({ width, result: 'PASS' });
    } finally { await context.close(); }
  }
  return { result: 'PASS', pantallas: results, comprobaciones: 'Recorrido solo con teclado: catálogo, cantidades, confirmación, foco, filtros, menú, preguntas y formulario.' };
}
