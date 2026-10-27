import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {instrument,start,stoppedAt} from './helpers/game';
const m=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8'));

test('Kottakkal legacy ride migrates geographically into the sole district world with reused buildings and labels',async({page})=>{
 const oldRide={version:1,mapId:m.legacySourceHash,x:31.14,z:64.95,heading:-1.516,phase:'dropoff'};
 const save={version:1,money:120,trips:1,teaBreaks:2,phase:'pickup',x:72,z:36,heading:0,osmRide:oldRide};
 await page.addInitScript(p=>{if(!localStorage.getItem('kottakkal-drive.v1')){localStorage.setItem('kottakkal-drive.v1',JSON.stringify(p));localStorage.setItem('en3d.world.v1','osm');}},save);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page,'/?world=osm');
 await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');await expect(page.locator('#location-label')).toContainText('Kottakkal');
 await expect(page.locator('#location-label')).toContainText('കോട്ടക്കല്‍');await expect(page.locator('#map-attribution')).toBeVisible();
 const before=await page.evaluate(()=>{const t=(window as any).__gameTest;return {car:{...t.car},buildings:t.streamed.data.buildings.length,resident:t.streamed.world.streaming.resident,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z)};});
 expect(before.car.x).toBeLessThan(-8500);expect(before.car.z).toBeGreaterThan(5500);expect(before.buildings).toBeGreaterThan(0);expect(before.onRoad).toBe(true);expect(before.resident).toBeLessThanOrEqual(9);
 expect(before.calls).toBeLessThan(350);expect(before.triangles).toBeLessThan(200000);console.log('Unified Kottakkal budget:',JSON.stringify(before));
 await page.screenshot({path:'test-results/district-kottakkal.png'});await page.reload();await page.locator('#start-button').click();
 await expect(page.locator('#location-label')).toContainText('Kottakkal');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kottakkal-drive.v1')!));
 expect(saved.osmRide).toEqual(oldRide);expect(saved.x).toBe(72);expect(saved.exportRide.mapId).toBe(m.source.sha256);expect(saved.exportRide.x).toBeCloseTo(before.car.x,3);expect(errors).toEqual([]);
});

test('travel between source road windows and Kottakkal streams geometry without document navigation or manual map changes',async({page})=>{
 await instrument(page);await start(page);const original=page.url();let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 const atKottakkal=m.places.find((p:any)=>p.name==='Kottakkal');
 const key=`${Math.floor(atKottakkal.x/600)},${Math.floor(atKottakkal.z/600)}`;
 const tile=JSON.parse(readFileSync('public/maps/district/'+m.tiles[key].file,'utf8'));
 const target=tile.roads.flatMap((r:any)=>r.points).find((p:any)=>Math.hypot(p.x-atKottakkal.x,p.z-atKottakkal.z)<100);
 expect(target).toBeTruthy();await stoppedAt(page,target);await expect(page.locator('#location-label')).toContainText('Kottakkal');
 const at=await page.evaluate(()=>{const t=(window as any).__gameTest;return {count:t.streamed.world.streaming.resident,blocked:t.streamed.world.isBlocked(t.car.x,t.car.z),buildings:t.streamed.data.buildings.length};});
 expect(at.count).toBeLessThanOrEqual(9);expect(at.blocked).toBe(false);expect(at.buildings).toBeGreaterThan(0);expect(page.url()).toBe(original);expect(navigations).toBe(0);
 await expect(page.locator('#world-select')).toHaveCount(0);
});
