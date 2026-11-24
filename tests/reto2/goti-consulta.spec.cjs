const {test,expect}=require('@playwright/test');
test('Goti responde a una pregunta coloquial en la tienda y conserva las órdenes locales',async({page})=>{
  await page.goto('/catalogo.html');
  const goti=page.locator('farmacia-mascota');
  await goti.locator('#launcher').click();
  await goti.getByRole('combobox',{name:'Modo',exact:true}).selectOption('consulta');
  await expect(goti.locator('.local-note')).toContainText('Google');
  await goti.locator('#input').fill('bro, ¿hasta qué hora atienden?');
  await goti.locator('#input').press('Enter');
  await expect(goti.getByRole('log')).toContainText('19:00');
  await goti.getByRole('combobox',{name:'Modo',exact:true}).selectOption('local');
  await goti.locator('#input').fill('hola');await goti.locator('#input').press('Enter');
  await expect(goti.getByRole('log')).toContainText('Puedo guiarte');
});
