import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {instrument,start,stoppedAt} from './helpers/game';
const manifest=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8'));

test('fresh gameplay visibly contains nearby moving traffic, mapped buildings and roadside planting',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);
 const probe=()=>page.evaluate(()=>{
  const t=(window as any).__gameTest,visible=t.traffic.sim.agents.filter((a:any)=>{
   const p=t.camera.position.clone().set(a.x,1,a.z).project(t.camera),distance=Math.hypot(a.x-t.car.x,a.z-t.car.z);
   return distance<95&&Math.abs(p.x)<.9&&p.y>-.85&&p.y<.85&&p.z>0&&p.z<1;
  }).map((a:any)=>({id:a.id,kind:a.kind,x:a.x,z:a.z,distance:a.distance}));
  let palms=0,buildingBatches=0;t.scene.traverseVisible((o:any)=>{if(o.isMesh&&o.material?.name==='Decorative palm crowns')palms++;if(o.isMesh&&o.material?.vertexColors&&o.geometry?.attributes?.position?.count>50)buildingBatches++;});
  return {visible,onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z),buildings:t.streamed.data.buildings.length,palms,buildingBatches,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,car:{...t.car},resident:t.streamed.world.streaming.resident};
 });
 await expect.poll(async()=>(await probe()).visible.length).toBeGreaterThanOrEqual(2);
 const before=await probe();expect(before.onRoad).toBe(true);expect(before.buildings).toBe(203);expect(before.palms).toBeGreaterThan(0);expect(before.buildingBatches).toBeGreaterThan(0);expect(before.resident).toBeLessThanOrEqual(9);
 await expect.poll(async()=>{const now=await probe();return now.visible.some(a=>before.visible.some(b=>a.id===b.id&&Math.hypot(a.x-b.x,a.z-b.z)>1));}).toBe(true);
 await page.screenshot({path:'test-results/visible-world-gameplay.png'});
 console.log('Visible gameplay evidence:',JSON.stringify(await probe()));expect(before.calls).toBeLessThan(350);expect(before.triangles).toBeLessThan(200000);
 await page.keyboard.press('KeyE');await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(p=>{const c=(window as any).__gameTest.car;return Math.hypot(c.x-p.x,c.z-p.z);},before.car)).toBeGreaterThan(30);await page.keyboard.up('KeyW');await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
 await page.screenshot({path:'test-results/visible-world-driving.png'});
 expect((await probe()).onRoad).toBe(true);expect(errors).toEqual([]);
});

test('legacy off-road ride is recovered locally without losing passenger, wallet or archived data',async({page})=>{
 const old={version:1,money:480,trips:4,teaBreaks:2,x:72,z:36,heading:0,phase:'pickup',osmRide:{version:1,mapId:manifest.legacySourceHash,x:31.14,z:64.95,heading:-1.516,phase:'pickup'},exportRide:{version:1,mapId:manifest.source.sha256,x:100,z:100,heading:0,phase:'dropoff'}};
 await page.addInitScript(value=>{if(!localStorage.getItem('kottakkal-drive.v1'))localStorage.setItem('kottakkal-drive.v1',JSON.stringify(value));},old);
 await instrument(page);await start(page);await expect(page.locator('#money')).toHaveText('₹480');await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 const recovered=await page.evaluate(()=>{const t=(window as any).__gameTest;return {car:{...t.car},onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z),blocked:t.streamed.world.isBlocked(t.car.x,t.car.z),save:JSON.parse(localStorage.getItem('kottakkal-drive.v1')!)};});
 expect(recovered.onRoad).toBe(true);expect(recovered.blocked).toBe(false);expect(Math.hypot(recovered.car.x-100,recovered.car.z-100)).toBeGreaterThan(2);expect(Math.hypot(recovered.car.x-100,recovered.car.z-100)).toBeLessThan(250);
 expect(recovered.save.osmRide).toEqual(old.osmRide);expect(recovered.save.x).toBe(72);expect(recovered.save.teaBreaks).toBe(2);expect(recovered.save.exportRide.phase).toBe('dropoff');
 await page.reload();await page.locator('#start-button').click();const after=await page.evaluate(()=>(window as any).__gameTest.car);expect(after.x).toBeCloseTo(recovered.car.x,3);expect(after.z).toBeCloseTo(recovered.car.z,3);
});

test('actual throttle crosses a source-road tile seam without a pavement gap or coordinate jump',async({page})=>{
 // Select real source geometry crossing a tile boundary, rather than manufacturing a link.
 let segment:any;const edges:any[]=[],outgoing=new Map<string,any[]>();
 for(const tile of Object.values(manifest.tiles) as any[]){
  const data=JSON.parse(readFileSync('public/maps/district/'+tile.file,'utf8'));
  for(const r of data.roads){if(r.width<6||r.oneway==='-1')continue;for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
   if(length<10)continue;const edge={a,b,dx,dz,length,to:r.nodeIds[i],from:r.nodeIds[i-1]};edges.push(edge);
   const list=outgoing.get(edge.from)??[];list.push(edge);outgoing.set(edge.from,list);
  }}
 }
 for(const e of edges){
  for(const axis of ['x','z']){
   const boundary=Math.round(e.b[axis]/600)*600;if(Math.abs(e.b[axis]-boundary)>.002)continue;
   const next=outgoing.get(e.to)?.find(n=>n.length>14&&(n.dx*e.dx+n.dz*e.dz)/(n.length*e.length)>.999);
   if(!next)continue;
   segment={x:e.b.x-e.dx/e.length*7,z:e.b.z-e.dz/e.length*7,heading:Math.atan2(-e.dx,-e.dz),boundary,axis};break;
  }if(segment)break;
 }
 expect(segment).toBeTruthy();await instrument(page);await start(page);await stoppedAt(page,segment);
 await page.evaluate(p=>{const t=(window as any).__gameTest;t.car.heading=p.heading;t.traffic.sim.enabled=false;t.traffic.sim.clear();},segment);
 const before=await page.evaluate(()=>(window as any).__gameTest.car);await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(p=>{const t=(window as any).__gameTest;return Math.hypot(t.car.x-p.x,t.car.z-p.z);},before)).toBeGreaterThan(15);
 await page.keyboard.up('KeyW');await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
 const after=await page.evaluate(()=>{const t=(window as any).__gameTest;return {car:t.car,onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z),blocked:t.streamed.world.isBlocked(t.car.x,t.car.z),resident:t.streamed.world.streaming.resident};});
 expect((before[segment.axis as 'x'|'z']-segment.boundary)*(after.car[segment.axis]-segment.boundary)).toBeLessThan(0);expect(after.onRoad).toBe(true);expect(after.blocked).toBe(false);expect(after.resident).toBeLessThanOrEqual(9);console.log('Driven source seam:',JSON.stringify({segment,after}));
});
