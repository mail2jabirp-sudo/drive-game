// Local review screenshots only; requires an already running Vite server.
// Usage: node scripts/capture_map_foundation.cjs before|after [http://localhost:5173]
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const outputRoot = path.resolve(__dirname, '../research/phase04');

async function capture() {
  const phase = process.argv[2];
  if (!['before', 'after'].includes(phase)) throw new Error('Expected before or after');
  const baseURL = process.argv[3] || 'http://127.0.0.1:5173';
  fs.mkdirSync(outputRoot, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.75,
    });
    await page.addInitScript(() => localStorage.setItem('en3d.display.v1', 'low'));
    // Change only the served test response; never add a shipped debug API.
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      if (!source.includes('renderer.render(scene, camera);')) throw new Error('Capture hook not found');
      await route.fulfill({ response, body: source.replace('renderer.render(scene, camera);', `
        if (window.__view) {
          const v = window.__view;
          scene.fog = null;
          camera.position.set(v.x, v.y, v.z + 0.01);
          camera.lookAt(v.x, 0, v.z);
          camera.updateMatrixWorld();
        }
        renderer.render(scene, camera);
        window.__cost = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      `) });
    });
    await page.goto(baseURL + '/?world=osm');
    await page.locator('#start-button:not([disabled])').waitFor({ timeout: 60000 });
    await page.locator('#start-button').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outputRoot, `${phase}-drive.png`) });
    const result = { drive: await page.evaluate(() => window.__cost) };
    for (const [name, view] of [
      ['bus-stand', { x: 15, y: 180, z: 20 }],
      ['junction', { x: 110, y: 125, z: 65 }],
    ]) {
      await page.evaluate(v => { window.__view = v; }, view);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputRoot, `${phase}-${name}.png`) });
      result[name] = await page.evaluate(() => window.__cost);
    }
    fs.writeFileSync(path.join(outputRoot, `${phase}-render-cost.json`), JSON.stringify(result, null, 2));
    console.log(phase, result);
  } finally {
    await browser.close();
  }
}
capture().catch(error => { console.error(error); process.exitCode = 1; });
