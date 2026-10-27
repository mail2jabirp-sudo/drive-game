import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {nearbyTileKeys} from '../src/road-tiles';
import type {RoadManifest,RoadTile} from '../src/road-tiles';
const manifest=JSON.parse(readFileSync('public/maps/malappuram/manifest.json','utf8')) as RoadManifest;
async function instrument(page:any){
  await page.route('**/src/main.ts*',async(route:any)=>{
    const response=await route.fetch();const source=await response.text();
    await route.fulfill({response,body:source.replace('renderer.render(scene, camera);','renderer.render(scene, camera); window.__roadTest={car,streamed,renderer,camera};')});
  });
  await page.addInitScript(()=>localStorage.setItem('en3d.display.v1','low'));
}
async function ready(page:any){await page.goto('/?world=malappuram');await expect(page.locator('#start-button')).toBeEnabled();await page.locator('#start-button').click();await expect(page.locator('#fatal-error')).toBeHidden();}

test('uploaded roads stream only nearby tiles, evict old geometry and support driving and missions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const requested:string[]=[];page.on('request',r=>{if(/\/maps\/malappuram\/-?\d+_-?\d+\.json$/.test(r.url()))requested.push(r.url());});
  await instrument(page);await ready(page);
  await expect(page.locator('#mission-title')).toHaveText('Malappuram road fare');
  const initial=await page.evaluate(()=>{const t=(window as any).__roadTest;return {keys:t.streamed.world.streaming.keys,camera:{x:t.camera.position.x,z:t.camera.position.z}};});
  // Origin bootstrap selects a connected mission; the chase camera may straddle the next cell.
  const allowed=new Set([...nearbyTileKeys(manifest,{x:0,z:0}),...nearbyTileKeys(manifest,initial.camera)]);
  expect(initial.keys.length).toBeLessThanOrEqual(9);
  for(const url of requested){const key=url.split('/').pop()!.replace('.json','').replace('_',',');expect(allowed.has(key)).toBe(true);}
  expect(requested.length).toBeLessThanOrEqual(allowed.size);expect(requested.length).toBeLessThan(Object.keys(manifest.tiles).length);
  await expect(page.locator('#interact-button')).toBeEnabled();await page.keyboard.press('KeyE');
  await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
  await page.keyboard.down('KeyW');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(8);
  await page.keyboard.up('KeyW');await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
  const before=await page.evaluate(()=>{const t=(window as any).__roadTest;return {keys:t.streamed.world.streaming.keys,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles};});
  expect(before.calls).toBeLessThan(300);expect(before.triangles).toBeLessThan(200000);
  // Exercise a real source-road position in a different cell without an extended automated drive.
  const tile=JSON.parse(readFileSync('public/maps/malappuram/'+manifest.tiles['2,0'].file,'utf8')) as RoadTile;
  const target=tile.roads.flatMap(r=>r.points).find(p=>p.x>1250&&p.x<1700&&p.z>20&&p.z<580)!;expect(target).toBeTruthy();
  await page.evaluate(p=>{const t=(window as any).__roadTest;t.car.x=p.x;t.car.z=p.z;t.car.speed=0;},target);
  await expect.poll(async()=>page.evaluate(()=>{const t=(window as any).__roadTest;return t.streamed.world.streaming.keys.includes('3,0')&&!t.streamed.world.streaming.loading;})).toBe(true);
  const after=await page.evaluate(()=>{const t=(window as any).__roadTest;return {keys:t.streamed.world.streaming.keys,blocked:t.streamed.world.isBlocked(t.car.x,t.car.z)};});
  expect(after.keys.length).toBeLessThanOrEqual(9);expect(after.keys).not.toContain('-1,0');expect(after.blocked).toBe(false);
  // Deliver the same saved passenger at the actual connected source-derived stop.
  const stop=await page.evaluate(()=>{const t=(window as any).__roadTest;t.car.x=t.streamed.world.dropoff.x;t.car.z=t.streamed.world.dropoff.z;t.car.speed=0;return t.streamed.world.dropoff;});
  await expect(page.locator('#interact-button')).toBeEnabled();await page.keyboard.press('KeyE');
  await expect(page.locator('#money')).toHaveText('₹120');await page.reload();await expect(page.locator('#start-button')).toBeEnabled();await page.locator('#start-button').click();
  await expect(page.locator('#money')).toHaveText('₹120');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kottakkal-drive.v1')!));
  expect(saved.exportRide.x).toBeCloseTo(stop.x,3);expect(saved.exportRide.mapId).toBe(manifest.source.sha256);
  await page.screenshot({path:'test-results/uploaded-road-game.png'});expect(errors).toEqual([]);
});

test('an unavailable uploaded tile offers the preserved practice game without erasing prior saves',async({page})=>{
  const old={version:1,money:240,trips:2,teaBreaks:1,phase:'dropoff',x:72,z:-12,heading:0};
  await page.addInitScript(value=>{if(!localStorage.getItem('kottakkal-drive.v1'))localStorage.setItem('kottakkal-drive.v1',JSON.stringify(value));},old);
  await page.route('**/maps/malappuram/*_*.json',route=>route.fulfill({status:503,body:'deliberate failure'}));
  await page.goto('/?world=malappuram');await expect(page.locator('#fatal-error')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kottakkal-drive.v1')!))).toEqual(old);
  await page.locator('#fatal-error a').click();await expect(page.locator('#start-button')).toBeEnabled();await page.locator('#start-button').click();
  await expect(page.locator('#money')).toHaveText('₹240');await expect(page.locator('#mission-title')).toHaveText('Next stop: market');
});
