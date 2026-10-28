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

test('a misplaced map is rejected before rendering or modifying either saved ride', async ({ page }) => {
  const save = { version: 1, money: 450, trips: 2, teaBreaks: 1, phase: 'dropoff', x: 72, z: -6, heading: 0,
    osmRide: { version: 1, mapId: map.source.sha256, ...stops.pickup, heading: stops.spawn.heading, phase: 'dropoff' } };
  await installSeed(page, save);
  const misplaced = structuredClone(map); misplaced.projection.latitude = 11.25;
  await page.route('**/maps/kottakkal.json*', route => route.fulfill({ json: misplaced }));
  await page.goto('/?world=osm');
  await expect(page.locator('#fatal-error')).toBeVisible();
  await expect(page.locator('#fatal-error')).toContainText('does not match the verified Kottakkal area');
  expect(await readSave(page)).toEqual(save);
  await expect(page.locator('#fatal-error a')).toHaveAttribute('href', '?world=practice');
});

test('foundation renders with aligned tires and explicit map boundary labels', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, 'low'), DISPLAY_KEY);
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('renderer.render(scene, camera);', `renderer.render(scene, camera);
      window.__foundationProbe = { stats: realWorld?.foundationStats, vehicleY: rickshaw.group.position.y,
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      if (!window.__depthSamples && realWorld) {
        const testScene = new THREE.Scene();
        const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, toneMapped: false });
        const roadMaterials = [];
        const root = scene.getObjectByName('OSM Kottakkal source geometry');
        const groundClone = root.children[0].clone(); groundClone.material = groundMaterial; testScene.add(groundClone);
        root.traverse(o => {
          if (!['OSM asphalt foundation', 'Authored road shoulder'].includes(o.name)) return;
          const material = new THREE.MeshBasicMaterial({ color: o.name === 'OSM asphalt foundation' ? 0xff0000 : 0x00ff00, toneMapped: false,
            polygonOffset: o.material.polygonOffset, polygonOffsetFactor: o.material.polygonOffsetFactor, polygonOffsetUnits: o.material.polygonOffsetUnits });
          const clone = o.clone(); clone.material = material; clone.visible = true; testScene.add(clone); roadMaterials.push(material);
        });
        const target = new THREE.WebGLRenderTarget(64, 64);
        const testCamera = new THREE.PerspectiveCamera(52, 1, .1, 600);
        const samples = [];
        for (const point of realWorld.mission.route.slice(0, 3)) {
          testCamera.position.set(point.x, 180, point.z + .00001); testCamera.lookAt(point.x, 0, point.z);
          renderer.setRenderTarget(target); renderer.render(testScene, testCamera);
          const pixels = new Uint8Array(4); renderer.readRenderTargetPixels(target, 32, 32, 1, 1, pixels); samples.push(Array.from(pixels));
        }
        renderer.setRenderTarget(null); target.dispose(); groundMaterial.dispose(); roadMaterials.forEach(m => m.dispose());
        window.__depthSamples = samples;
      }`) });
  });
  await start(page);
  await expect.poll(() => page.evaluate(() => (window as any).__foundationProbe?.stats?.joins ?? 0)).toBeGreaterThan(0);
  const p = await page.evaluate(() => (window as any).__foundationProbe);
  expect(p.vehicleY).toBeCloseTo(.004, 6);
  expect(p.stats.boundaryEnds).toBeGreaterThan(0);
  expect(p.stats.omittedBuildingIds.length).toBeGreaterThan(0);
  expect(p.stats.omittedBuildingIds.length).toBeLessThan(map.buildings.length / 2);
  expect(p.calls).toBeLessThan(300); expect(p.triangles).toBeLessThan(200_000);
  const depthSamples = await page.evaluate(() => (window as any).__depthSamples);
  expect(depthSamples).toHaveLength(3);
  for (const pixel of depthSamples) {
    expect(pixel[0]).toBeGreaterThan(240); expect(pixel[1]).toBeLessThan(10);
  }
});

test('Kerala road dressing stays within mobile render budgets and keeps optional details out of Battery saver', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: .75, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(key => localStorage.setItem(key, 'low'), DISPLAY_KEY);
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('renderer.render(scene, camera);', `
        if (window.__forceStyleDetails) realWorld?.update(elapsed, camera.position, false);
        renderer.render(scene, camera);
        let detailMeshes = 0;
        scene.traverseVisible(o => { if (o.name === 'Authored road weathering and drainage') detailMeshes++; });
        window.__roadStyleProbe = { styles: realWorld?.roadStyleStats, details: detailMeshes,
          calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures,
          mapHash: mapData?.source.sha256, camera: camera.position.toArray() };`) });
    });
    await start(page);
    await expect.poll(() => page.evaluate(() => (window as any).__roadStyleProbe?.styles?.drains ?? 0)).toBeGreaterThan(0);
    const low = await page.evaluate(() => (window as any).__roadStyleProbe);
    expect(low.details).toBe(0);
    expect(low.styles.shoulderPatches).toBeGreaterThan(500);
    expect(low.styles.markedRoads).toBe(8);
    expect(low.styles.concreteRoads).toBe(1); expect(low.styles.gravelRoads).toBe(1);
    expect(low.calls).toBeLessThan(160); expect(low.triangles).toBeLessThan(12000);
    await page.screenshot({ path: 'research/phase05/after-mobile-landscape.png' });
    await page.evaluate(() => { (window as any).__forceStyleDetails = true; });
    await expect.poll(() => page.evaluate(() => (window as any).__roadStyleProbe?.details ?? 0)).toBeGreaterThan(0);
    const full = await page.evaluate(() => (window as any).__roadStyleProbe);
    expect(full.calls).toBeLessThan(220); expect(full.triangles).toBeLessThan(18000); expect(full.textures).toBeLessThan(40);
    expect(full.mapHash).toBe(map.source.sha256); expect(full.camera.every(Number.isFinite)).toBe(true);
    console.log('Phase 05 mobile low/detail samples:', JSON.stringify({ low, full }));
    await page.evaluate(() => { (window as any).__forceStyleDetails = false; });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-control="throttle"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'research/phase05/after-mobile-portrait.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
