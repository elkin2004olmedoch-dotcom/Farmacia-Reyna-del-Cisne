/* Run from the repository; uses its existing Playwright dev dependency. */
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'previews');
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8768/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.MascotaFarmacia?.getStatus().availableStates.length > 0);
    assert.equal(await page.locator('.character-card').count(), 3, 'three distinct companions');
    const characterStates = await page.evaluate(() => fetch('sprites/manifest.json').then(response => response.json()).then(data => ({ complete: data.complete, states: data.characters.map(item => ({ id: item.id, states: Object.keys(item.states) })) })));
    for (const item of characterStates.states) {
      await page.evaluate((id) => MascotaFarmacia.setCharacter(id), item.id);
      if (characterStates.complete) assert.equal(item.states.length, 9, `${item.id} has all nine states`);
      for (const state of item.states) {
        assert.equal(await page.evaluate((name) => MascotaFarmacia.setState(name, { loop: true }), state), true);
        assert.equal(await page.evaluate(() => MascotaFarmacia.getStatus().state), state, `${item.id} plays ${state}`);
      }
    }
    await page.getByRole('button', { name: /Elegir a Boti/ }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.MascotaFarmacia?.getStatus().availableStates.length > 0);
    assert.equal(await page.evaluate(() => MascotaFarmacia.getStatus().character), 'boti', 'selection survives reload');
    const states = await page.evaluate(() => MascotaFarmacia.getStatus().availableStates);
    if (states.includes('waving')) {
      await page.evaluate(() => MascotaFarmacia.setState('waving', { loop: true }));
      const first = await page.evaluate(() => document.querySelector('canvas').toDataURL());
      await page.waitForTimeout(340);
      const second = await page.evaluate(() => document.querySelector('canvas').toDataURL());
      assert.notEqual(first, second, 'rendered frame pixels change during a real animation');
    }
    await page.getByRole('button', { name: 'Pausar animación', exact: true }).click();
    const frozen = await page.evaluate(() => MascotaFarmacia.getStatus());
    await page.waitForTimeout(370);
    assert.deepEqual(await page.evaluate(() => MascotaFarmacia.getStatus()), frozen, 'pause stops frame progression');
    await page.getByRole('button', { name: 'Reanudar animación', exact: true }).click();
    if (states.includes('running-right')) {
      await page.locator('[data-state="running-right"]').click();
      const from = await page.evaluate(() => MascotaFarmacia.getStatus().x);
      await page.waitForTimeout(500);
      assert.ok(await page.evaluate(() => MascotaFarmacia.getStatus().x) > from, 'walking moves the companion across the stage');
    }
    await page.getByRole('button', { name: /Buscar un producto/ }).click();
    if (states.includes('running')) assert.equal(await page.evaluate(() => MascotaFarmacia.getStatus().state), 'running', 'chat triggers thinking');
    await page.waitForTimeout(1800);
    assert.match(await page.locator('#messages').innerText(), /disponibilidad/, 'chat gives the local catalogue demonstration response');
    await page.evaluate(() => MascotaFarmacia.setCharacter('goti'));
    await page.screenshot({ path: path.join(output, 'demo-escritorio.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'demo-movil.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile has no horizontal overflow');
    assert.deepEqual(issues, [], 'no uncaught browser errors');
    const result = { ok: true, complete: characterStates.complete, characterStates: characterStates.states, testedCharacter: 'boti', statesAvailable: states, checks: ['three companions and every available state', 'persistent selection', 'animated pixels', 'pause', 'walking movement', 'chat and thinking', 'mobile layout', 'no browser errors'] };
    fs.writeFileSync(path.join(output, 'prueba-demo.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
