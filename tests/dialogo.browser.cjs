async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 940 } });
  const p = await context.newPage();
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await p.goto('http://127.0.0.1:4173/catalogo.html');
    await p.locator('.catalog-add').first().waitFor();
    await p.locator('.catalog-add[data-product-id="vitaminas"]').click();
    await p.locator('.catalog-add[data-product-id="solar"]').click();
    await p.locator('.cart-trigger').click();
    await p.evaluate(() => {
      const remove = document.querySelector('[data-cart-action="remove"][data-product-id="vitaminas"]');
      remove.click();
      document.getElementById('cart-remove-cancel').click();
      remove.click();
      // El navegador puede entregar el evento close anterior después de reabrir.
      document.getElementById('cart-remove-dialog').dispatchEvent(new Event('close'));
    });
    check(await p.locator('#cart-remove-dialog').evaluate(el => el.open), 'La confirmación nueva debe permanecer abierta.');
    await p.locator('#cart-remove-confirm').click();
    check(await p.locator('.cart-item').count() === 1, 'Un close atrasado no debe borrar el producto pendiente de eliminar.');
    check(await p.locator('.cart-item').getAttribute('data-cart-item-id') === 'solar', 'Debe conservarse el producto solar.');
    check((await p.locator('#cart-total').innerText()).includes('9,75'), 'El total debe actualizarse a $9,75.');
    return { result: 'PASS', comprobacion: 'Cancelar, reabrir y confirmar con un evento close atrasado.' };
  } finally { await context.close(); }
}
