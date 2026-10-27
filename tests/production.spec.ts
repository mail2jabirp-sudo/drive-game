import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function publishedFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = prefix + entry.name;
    return entry.isDirectory() ? publishedFiles(join(directory, entry.name), path + '/') : [path];
  });
}

test('production HTML, hashed bundles, geographic data and license notice are published intact', async ({ request }) => {
  const files = publishedFiles('dist');
  expect(files).toContain('index.html');
  expect(files).toContain('maps/kottakkal.json');
  expect(files).toContain('maps/NOTICE.txt');
  expect(files.some(file => /^assets\/.+\.js$/.test(file))).toBe(true);
  expect(files.some(file => /^assets\/.+\.css$/.test(file))).toBe(true);
  for (const file of files) {
    const response = await request.get('/' + file);
    expect(response.status(), file).toBe(200);
    expect(Buffer.compare(await response.body(), readFileSync(join('dist', file))), file).toBe(0);
    if (/\.(js|css|json)$/.test(file)) expect(response.headers()['content-type']).not.toContain('text/html');
  }
  const html = await (await request.get('/')).text();
  expect(html).toContain('EN 3D');
  expect(html).not.toContain('/src/main.ts');
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)) {
    expect(files).toContain(match[1].slice(1));
  }
  const map = await (await request.get('/maps/kottakkal.json')).json();
  expect(map.source.sha256).toBe(createHash('sha256').update(readFileSync('map.osm')).digest('hex'));
  expect(map.roads.length).toBe(68);
  expect(map.buildings.length).toBe(203);
  expect(await (await request.get('/maps/NOTICE.txt')).text()).toContain('OpenStreetMap contributors');
  expect(files).not.toContain('map.osm');
  expect(files).not.toContain('export.osm');
});

for (const mode of ['', '?world=osm', '?world=practice', '?world=malappuram'] as const) {
  test(`compiled ${mode} game loads, drives, saves and reloads without failed local assets`, async ({ page }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === 'http://127.0.0.1:4173' && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => failedAssets.push(request.url()));
    await page.addInitScript(() => localStorage.setItem('en3d.display.v1', 'low'));
    const mapResponse = page.waitForResponse(response => response.url().endsWith('/maps/district/manifest.json') && response.status() === 200);
    await page.goto(`/${mode}`);
    if (mapResponse) await mapResponse;
    await expect(page.locator('#start-button')).toBeEnabled();
    await expect(page).toHaveTitle('EN 3D — എന്റെ നാട് · Kerala Open World Simulator');
    await expect(page.locator('.welcome-copy h1')).toHaveText('EN 3D — എന്റെ നാട്');
    await expect(page.locator('.project-subtitle')).toHaveText('Kerala Open World Simulator');
    await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content','EN 3D — എന്റെ നാട്');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/Kerala Open World Simulator/);
    await expect(page.locator('.project-subtitle')).toHaveCSS('text-transform','none');
    expect(await page.locator('body').innerText()).not.toMatch(/Malappuram\s+District/i);
    await page.locator('#start-button').click();
    await expect(page.locator('#fatal-error')).toBeHidden();
    await expect(page.locator('#start-screen')).toBeHidden();
    await expect(page.locator('#mission-title')).toHaveText('Passenger fare');
    await expect.poll(async()=>parseInt(await page.locator('#traffic-status').textContent()??'',10)).toBeGreaterThan(1);
    await expect(page.locator('.map-heading > span').first()).toHaveText('Kerala Open World Simulator');
    expect(await page.locator('body').innerText()).not.toMatch(/Malappuram\s+District/i);
    await expect(page.locator('#map-attribution')).toBeVisible();
    await expect(page.locator('#world-select')).toHaveCount(0);
    await expect(page.locator('#change-area')).toHaveCount(0);
    await page.keyboard.down('KeyW');
    await expect.poll(async () => Number(await page.locator('#speed').textContent())).toBeGreaterThan(8);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('Space');
    await expect(page.locator('#speed')).toHaveText('0');
    await page.keyboard.up('Space');
    await page.keyboard.press('KeyP');
    const saved = await page.evaluate(() => localStorage.getItem('kottakkal-drive.v1'));
    expect(saved).not.toBeNull();
    await page.reload();
    await expect(page.locator('#start-button')).toBeEnabled();
    await page.locator('#start-button').click();
    await expect(page.locator('#fatal-error')).toBeHidden();
    await expect(page.locator('#money')).toHaveText('₹0');
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
  });
}
