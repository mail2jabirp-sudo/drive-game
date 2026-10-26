import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { selectMissionStops } from '../src/osm-navigation';
import type { OsmMap } from '../src/osm-types';
import { FARE, SAVE_KEY } from '../src/progress';
import { DISPLAY_KEY } from '../src/graphics';

const map = JSON.parse(readFileSync(new URL('../public/maps/kottakkal.json', import.meta.url), 'utf8')) as OsmMap;
const stops = selectMissionStops(map);
interface OsmProbe {
  calls: number;
  triangles: number;
  mapRoads: number;
  mapBuildings: number;
  mapHash: string;
  chunks: number;
  car: { x: number; z: number; heading: number; speed: number };
  camera: number[];
  onRoad: boolean;
  blocked: boolean;
}
const probe = (page: Page) => page.evaluate(() => (window as Window & { __osmProbe?: OsmProbe }).__osmProbe);
const readSave = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);

async function installProbe(page: Page): Promise<void> {
  // Instrument the test response only; no debug API is added to the shipped game.
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace('renderer.render(scene, camera);', `renderer.render(scene, camera);
      window.__osmProbe = {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        mapRoads: mapData?.roads.length ?? 0, mapBuildings: mapData?.buildings.length ?? 0,
        mapHash: mapData?.source.sha256 ?? '', chunks: realWorld?.chunkCount ?? 0,
        car: { x: car.x, z: car.z, heading: car.heading, speed: car.speed },
        camera: camera.position.toArray(), onRoad: surface.roadSurface(car.x, car.z),
        blocked: surface.isBlocked(car.x, car.z)
      };`) });
  });
}
async function start(page: Page, path = '/?world=osm'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#start-button').click();
  await expect(page.locator('#start-screen')).toBeHidden();
  await expect(page.locator('#fatal-error')).toBeHidden();
}
async function seedNextNavigation(page: Page, save: object): Promise<void> {
  await page.evaluate(p => { window.name = 'osm-e2e:' + JSON.stringify(p); }, save);
}
async function installSeed(page: Page, initialSave: object): Promise<void> {
  await page.addInitScript(({ key, initial, displayKey }) => {
    if (window.name.startsWith('osm-e2e:')) {
      localStorage.setItem(key, window.name.slice('osm-e2e:'.length)); window.name = '';
    } else if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    localStorage.setItem(displayKey, 'low');
  }, { key: SAVE_KEY, initial: initialSave, displayKey: DISPLAY_KEY });
}

test('real Kottakkal geometry, attribution, camera and mobile pedals work within render budgets', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 0.75, isMobile: true, hasTouch: true });
  try {
    await context.addInitScript(key => localStorage.setItem(key, 'low'), DISPLAY_KEY);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installProbe(page);
    await start(page, '/');
    expect(await page.evaluate(() => localStorage.getItem('en3d.world.v1'))).toBe('osm');
    await expect(page.locator('body')).toHaveClass(/osm-mode/);
    await expect(page.locator('#map-attribution')).toBeVisible();
    await expect(page.locator('#map-attribution a').first()).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    await expect(page.locator('#map-attribution a').first()).toHaveText('OpenStreetMap contributors');
    await expect(page.locator('#map-attribution a').last()).toHaveAttribute('href', 'https://opendatacommons.org/licenses/odbl/1-0/');
    await expect(page.locator('#road-rules')).toContainText(/OSM|limit unmapped/);
    await expect.poll(async () => (await probe(page))?.calls ?? 0).toBeGreaterThan(0);
    const initial = (await probe(page))!;
    expect(initial.mapRoads).toBe(map.roads.length);
    expect(initial.mapBuildings).toBe(map.buildings.length);
    expect(initial.mapHash).toBe(map.source.sha256);
    expect(initial.chunks).toBeGreaterThan(0);
    expect(initial.calls).toBeLessThan(300);
    expect(initial.triangles).toBeLessThan(200_000);
    expect(initial.onRoad).toBe(true);
    expect(initial.blocked).toBe(false);
    expect(initial.camera.every(Number.isFinite)).toBe(true);
    expect(initial.camera[1]).toBeGreaterThan(3);

    const throttle = await page.locator('[data-control="throttle"]').boundingBox();
    const attribution = await page.locator('#map-attribution').boundingBox();
    expect(throttle).toBeTruthy(); expect(attribution).toBeTruthy();
    expect(attribution!.y + attribution!.height).toBeLessThan(throttle!.y);
    await page.mouse.move(throttle!.x + throttle!.width / 2, throttle!.y + throttle!.height / 2);
    await page.mouse.down();
    await expect.poll(async () => Number(await page.locator('#speed').textContent())).toBeGreaterThan(8);
    await page.mouse.up();
    await page.keyboard.down('Space');
    await expect(page.locator('#speed')).toHaveText('0');
    await page.keyboard.up('Space');
    await expect.poll(async () => {
      const current = await probe(page);
      return current ? Math.hypot(current.car.x - initial.car.x, current.car.z - initial.car.z) : 0;
    }).toBeGreaterThan(0.5);
    await expect.poll(async () => {
      const current = await probe(page);
      return current ? Math.hypot(current.camera[0] - initial.camera[0], current.camera[2] - initial.camera[2]) : 0;
    }).toBeGreaterThan(0.2);
    const driven = (await probe(page))!;
    expect(driven.car.x).toBeGreaterThan(map.bounds.minX);
    expect(driven.car.x).toBeLessThan(map.bounds.maxX);
    expect(driven.car.z).toBeGreaterThan(map.bounds.minZ);
    expect(driven.car.z).toBeLessThan(map.bounds.maxZ);
    await page.locator('#reset-button').tap();
    await expect.poll(async () => {
      const current = await probe(page);
      return current ? Math.hypot(current.car.x - stops.spawn.x, current.car.z - stops.spawn.z) : Infinity;
    }).toBeLessThan(0.05);
    console.log('Kottakkal OSM Battery saver render:', JSON.stringify(initial));
    await page.screenshot({ path: 'test-results/osm-mobile.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('OSM passenger fare and large map coordinates persist while switching preserves the legacy ride', async ({ page }) => {
  test.setTimeout(180_000);
  const legacy = { version: 1, money: 240, trips: 2, teaBreaks: 3, phase: 'dropoff', x: 72, z: -6, heading: 0.1 };
  await installSeed(page, { ...legacy, osmRide: { version: 1, mapId: map.source.sha256, ...stops.spawn, phase: 'pickup' } });
  await installProbe(page);
  await start(page);
  await expect(page.locator('#interact-button')).toBeEnabled();
  await page.keyboard.press('KeyE');
  await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
  const aboard = await readSave(page);
  expect(aboard.osmRide.phase).toBe('dropoff');
  expect(aboard.money).toBe(legacy.money);
  expect(aboard.phase).toBe(legacy.phase);
  expect(aboard.x).toBe(legacy.x); expect(aboard.z).toBe(legacy.z);

  // Reposition a genuine saved passenger to the source-derived connected road stop.
  await seedNextNavigation(page, { ...aboard, osmRide: { ...aboard.osmRide, ...stops.dropoff } });
  await start(page);
  await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
  await expect(page.locator('#interact-button')).toBeEnabled();
  await page.locator('#interact-button').click();
  await expect(page.locator('#money')).toHaveText(`₹${legacy.money + FARE}`);
  await expect(page.locator('#trips')).toHaveText(String(legacy.trips + 1));
  await start(page);
  await expect(page.locator('#money')).toHaveText(`₹${legacy.money + FARE}`);
  await expect.poll(async () => (await probe(page))?.car.x ?? 0).toBeGreaterThan(115);
  const delivered = await readSave(page);
  expect(delivered.osmRide.x).toBeCloseTo(stops.dropoff.x, 3);
  expect(delivered.osmRide.z).toBeCloseTo(stops.dropoff.z, 3);
  expect(delivered.osmRide.phase).toBe('pickup');
  expect(delivered.teaBreaks).toBe(legacy.teaBreaks);
  await page.screenshot({ path: 'test-results/osm-delivered.png' });

  await page.locator('#display-settings summary').click();
  await page.locator('#change-area').click();
  await expect(page.locator('#start-screen')).toBeVisible();
  await expect(page.locator('#world-select')).toHaveValue('osm');
  await Promise.all([
    page.waitForURL(url => url.searchParams.get('world') === 'practice'),
    page.locator('#world-select').selectOption('practice'),
  ]);
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#start-button').click();
  await expect(page.locator('#mission-title')).toHaveText('Next stop: market');
  await expect(page.locator('#money')).toHaveText(`₹${legacy.money + FARE}`);
  const restored = await readSave(page);
  expect(restored.x).toBe(legacy.x); expect(restored.z).toBe(legacy.z);
  expect(restored.heading).toBeCloseTo(legacy.heading, 5);
  expect(restored.phase).toBe(legacy.phase);
  expect(restored.osmRide.x).toBeCloseTo(stops.dropoff.x, 3);
  expect(restored.osmRide.phase).toBe('pickup');
  await expect(page.locator('#map-attribution')).toBeHidden();
});

test('a failed map fetch offers the original game without erasing either saved ride', async ({ page }) => {
  const legacy = {
    version: 1, money: 500, trips: 3, teaBreaks: 2, phase: 'dropoff', x: 72, z: -6, heading: 0,
    osmRide: { version: 1, mapId: map.source.sha256, ...stops.dropoff, heading: stops.spawn.heading, phase: 'pickup' },
  };
  await installSeed(page, legacy);
  await page.route('**/maps/kottakkal.json*', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'Deliberate map-unavailable test' }));
  await page.goto('/?world=osm');
  await expect(page.locator('#fatal-error')).toBeVisible();
  await expect(page.locator('#fatal-error')).toContainText('Your saved progress is safe');
  expect(await readSave(page)).toEqual(legacy);
  const fallback = page.locator('#fatal-error a');
  await expect(fallback).toHaveAttribute('href', '?world=practice');
  await Promise.all([
    page.waitForURL(url => url.searchParams.get('world') === 'practice'),
    fallback.click(),
  ]);
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#start-button').click();
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(page.locator('#mission-title')).toHaveText('Next stop: market');
  await expect(page.locator('#money')).toHaveText('₹500');
  const restored = await readSave(page);
  expect(restored.x).toBe(legacy.x); expect(restored.z).toBe(legacy.z);
  expect(restored.osmRide).toEqual(legacy.osmRide);
  expect(restored.teaBreaks).toBe(legacy.teaBreaks);
});
