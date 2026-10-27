import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {instrument,start,stoppedAt,interact} from './helpers/game';

test('pickup activates visible source-road GPS arrows; taking another road recalculates the passenger route',async({page})=>{
 await instrument(page);await start(page);await expect(page.locator('#gps-arrow svg')).toBeVisible();
 const passenger=await page.evaluate(()=>{const t=(window as any).__gameTest,p=t.scene.getObjectByName('Passenger at validated roadside pickup');return {visible:p.visible,onRoad:t.streamed.world.roadSurface(p.position.x,p.position.z),blocked:t.streamed.world.isBlocked(p.position.x,p.position.z)};});
 expect(passenger).toEqual({visible:true,onRoad:false,blocked:false});await interact(page);await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');await expect(page.locator('#gps-distance')).toContainText('drop-off');
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.scene.getObjectByName('GPS source-road direction arrows').count)).toBeGreaterThan(0);
 const before=await page.evaluate(()=>{const t=(window as any).__gameTest;return {route:t.navigation.route,revision:t.navigation.revision};});expect(before.route.available).toBe(true);expect(before.route.points.length).toBeGreaterThan(2);
 const branch=await page.evaluate(()=>{const t=(window as any).__gameTest,points=t.navigation.route.points,roads=t.streamed.data.roads;
  const candidates=roads.flatMap((r:any)=>r.points).filter((p:any)=>Math.hypot(p.x-t.car.x,p.z-t.car.z)>35&&Math.hypot(p.x-t.car.x,p.z-t.car.z)<120&&points.every((q:any)=>Math.hypot(p.x-q.x,p.z-q.z)>15));
  return candidates.find((p:any)=>t.streamed.world.roadSurface(p.x,p.z)&&!t.streamed.world.isBlocked(p.x,p.z));
 });expect(branch).toBeTruthy();await stoppedAt(page,branch);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.navigation.revision)).toBeGreaterThan(before.revision);
 const after=await page.evaluate(()=>(window as any).__gameTest.navigation.route);expect(after.available).toBe(true);expect(Math.hypot(after.points[0].x-branch.x,after.points[0].z-branch.z)).toBeLessThan(2);
 await expect(page.locator('#gps-instruction')).not.toContainText('outside');await page.screenshot({path:'test-results/gps-rerouted-gameplay.png'});
});

test('mapped signal HUD counts the same simulated phase as AI, freezes on pause and resumes',async({page})=>{
 const manifest=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8'));
 const controls=JSON.parse(readFileSync('public/maps/district/traffic-controls.json','utf8')).controls;
 let target:any;
 for(const c of controls.filter((c:any)=>c.kind==='traffic_signals')){
  const key=`${Math.floor(c.x/600)},${Math.floor(c.z/600)}`,desc=manifest.tiles[key];if(!desc)continue;
  const tile=JSON.parse(readFileSync('public/maps/district/'+desc.file,'utf8'));
  for(const road of tile.roads){const i=road.nodeIds.indexOf(c.nodeId);if(i<1||road.width<5||road.oneway==='-1')continue;
   const a=road.points[i-1],b=road.points[i],len=Math.hypot(b.x-a.x,b.z-a.z);if(len<22)continue;
   target={x:b.x+(a.x-b.x)*18/len,z:b.z+(a.z-b.z)*18/len,heading:Math.atan2(-(b.x-a.x),-(b.z-a.z)),nodeId:c.nodeId};break;
  }if(target)break;
 }
 expect(target).toBeTruthy();await instrument(page);await start(page);await stoppedAt(page,target);
 await page.evaluate(p=>{const t=(window as any).__gameTest;t.car.heading=p.heading;t.traffic.sim.clock=5;t.traffic.sim.spawning=false;t.traffic.sim.clear();},target);
 await expect(page.locator('#signal-status')).toBeVisible();await expect(page.locator('#signal-status')).toContainText('Simulated signal');await expect(page.locator('#signal-status')).toContainText(/\d+ s/);
 const first=await page.locator('#signal-status').textContent();await expect.poll(()=>page.locator('#signal-status').textContent()).not.toBe(first);
 await page.keyboard.press('KeyP');await page.waitForTimeout(300);const frozen=await page.locator('#signal-status').textContent();await page.waitForTimeout(1100);expect(await page.locator('#signal-status').textContent()).toBe(frozen);await page.keyboard.press('KeyP');await expect.poll(()=>page.locator('#signal-status').textContent()).not.toBe(frozen);
 await page.screenshot({path:'test-results/mapped-signal-countdown.png'});
});
