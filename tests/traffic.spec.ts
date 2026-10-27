import {test,expect} from '@playwright/test';
import {instrument,start,stoppedAt} from './helpers/game';
import {TRAFFIC} from '../src/traffic-types';
import {rectanglesOverlap} from '../src/traffic-sim';

test('nearby traffic actually moves on source roads with bounded instances and density preferences',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.length)).toBeGreaterThan(2);
 const first=await page.evaluate(()=>{const t=(window as any).__gameTest;return {id:t.traffic.sim.agents[0].id,distance:t.traffic.sim.agents[0].distance};});
 await expect.poll(()=>page.evaluate(p=>{const a=(window as any).__gameTest.traffic.sim.agents.find((a:any)=>a.id===p.id);return a?a.distance-p.distance:0;},first)).toBeGreaterThan(2);
 const probe=await page.evaluate(()=>{const t=(window as any).__gameTest;return {count:t.traffic.sim.agents.length,kinds:[...new Set(t.traffic.sim.agents.map((a:any)=>a.kind))],calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,source:t.streamed.manifest.source.sha256};});
 expect(probe.count).toBeLessThanOrEqual(6);expect(probe.kinds.length).toBeGreaterThanOrEqual(2);expect(probe.calls).toBeLessThan(300);expect(probe.triangles).toBeLessThan(200000);console.log('Traffic render budget:',JSON.stringify(probe));
 await page.keyboard.press('KeyP');const clock=await page.evaluate(()=>(window as any).__gameTest.traffic.sim.clock);await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__gameTest.traffic.sim.clock)).toBe(clock);
 await page.locator('#display-settings').click();await page.locator('#traffic-density').selectOption('high');await page.locator('#clear-traffic').click();
 expect(await page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.length)).toBe(0);
 await page.reload();await page.locator('#start-button').click();expect(await page.evaluate(()=>(window as any).__gameTest.traffic.sim.density)).toBe('high');
 await expect(page.locator('.project-subtitle')).toHaveText('Kerala Open World Simulator');await expect(page.locator('#world-select')).toHaveCount(0);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/traffic-prototype.png'});
});

test('player stops before traffic contact and traffic audio has real output, mute and bounded voices',async({page})=>{
 await instrument(page);await start(page);await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.length)).toBeGreaterThan(2);
 const target=await page.evaluate(specs=>{
  const t=(window as any).__gameTest;
  const a=t.traffic.sim.agents.find((a:any)=>{const e=t.traffic.sim.edges.get(a.edge),s=specs[a.kind as keyof typeof specs],gap=s.length/2+1.5+2;const x=a.x+Math.sin(a.heading)*gap,z=a.z+Math.cos(a.heading)*gap;return a.s>gap+1&&a.s<e.length-1&&t.streamed.world.roadSurface(x,z)&&!t.streamed.world.isBlocked(x,z);});
  if(!a)throw new Error('No clear real-road traffic test position');
  t.traffic.sim.enabled=false;t.traffic.sim.agents.splice(0,t.traffic.sim.agents.length,a);a.speed=0;
  const s=specs[a.kind as keyof typeof specs],gap=s.length/2+1.5+2;return {x:a.x+Math.sin(a.heading)*gap,z:a.z+Math.cos(a.heading)*gap,heading:a.heading};
 },TRAFFIC);
 await stoppedAt(page,target);await page.evaluate(h=>(window as any).__gameTest.car.heading=h,target.heading);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().traffic?.active??0)).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().traffic?.rms??0)).toBeGreaterThan(.00001);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(p=>{const c=(window as any).__gameTest.car;return Math.hypot(c.x-p.x,c.z-p.z);},target)).toBeGreaterThan(.2);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.car.speed)).toBe(0);await page.keyboard.up('KeyW');
 const pair=await page.evaluate(()=>{const t=(window as any).__gameTest;return {player:{...t.car,length:3,width:1.8},other:{...t.traffic.sim.agents[0]},audio:t.audio.diagnostics()};});
 expect(rectanglesOverlap(pair.player,{...pair.other,...TRAFFIC[pair.other.kind as keyof typeof TRAFFIC]})).toBe(false);expect(pair.audio.traffic.active).toBeLessThanOrEqual(4);expect(pair.audio.traffic.pool).toBe(4);expect(pair.audio.traffic.transients).toBeLessThanOrEqual(4);
 await page.locator('#sound-button').click();await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeLessThan(.000001);
 await page.locator('#sound-button').click();await page.locator('#display-settings').click();await page.locator('#audio-volume').evaluate((el:HTMLInputElement)=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#settings-dialog [data-close]').last().click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeLessThan(.000001);
});

test('missing control metadata disables AI safely while the preserved game remains playable',async({page})=>{
 await page.route('**/traffic-controls.json',route=>route.fulfill({status:503,body:'deliberate unavailable traffic metadata'}));await instrument(page);await start(page);
 expect(await page.evaluate(()=>(window as any).__gameTest.traffic.available)).toBe(false);expect(await page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.length)).toBe(0);
 await page.keyboard.down('KeyW');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(5);await page.keyboard.up('KeyW');await expect(page.locator('#fatal-error')).toBeHidden();
});

test('buses and lorries spawn and render on the verified major road rather than narrow town streets',async({page})=>{
 await instrument(page);await start(page);await stoppedAt(page,{x:0,z:0});
 const result=await page.evaluate(()=>{const t=(window as any).__gameTest,sim=t.traffic.sim;sim.clear();sim.hour=12;
  const seen=new Set<string>();for(let i=0;i<1000;i++){sim.update(.05,t.car);for(const a of sim.agents)seen.add(a.kind);if(sim.agents.some((a:any)=>a.kind==='bus')&&sim.agents.some((a:any)=>a.kind==='lorry'))break;}
  const bus=sim.agents.find((a:any)=>a.kind==='bus');if(bus)t.car.heading=Math.atan2(-(bus.x-t.car.x),-(bus.z-t.car.z));
  return {seen:[...seen],count:sim.agents.length,onRoad:sim.agents.every((a:any)=>t.streamed.world.roadSurface(a.x,a.z))};});
 expect(result.seen).toContain('bus');expect(result.seen).toContain('lorry');expect(result.count).toBeLessThanOrEqual(6);expect(result.onRoad).toBe(true);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__gameTest.scene;return s.getObjectByName('Traffic bus detailed').count+s.getObjectByName('Traffic bus distant').count;})).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__gameTest.scene;return s.getObjectByName('Traffic lorry detailed').count+s.getObjectByName('Traffic lorry distant').count;})).toBeGreaterThan(0);
 await expect(page.locator('#toast')).not.toHaveClass(/visible/);
 const visible=await page.evaluate(()=>{const t=(window as any).__gameTest;return t.traffic.sim.agents.map((a:any)=>{const p=t.camera.position.clone().set(a.x,1.5,a.z).project(t.camera);return {kind:a.kind,x:p.x,y:p.y,z:p.z,world:[a.x,a.z]};});});
 console.log('Traffic view projection:',JSON.stringify(visible));expect(visible.some((p:any)=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1&&p.z>0)).toBe(true);
 await page.screenshot({path:'test-results/traffic-major-road.png'});
 await page.locator('#display-settings').click();await page.locator('#quality-select').selectOption('auto');await page.locator('#traffic-density').selectOption('high');await page.locator('#settings-dialog [data-close]').last().click();
 await page.evaluate(()=>{const t=(window as any).__gameTest;for(let i=0;i<300;i++)t.traffic.sim.update(.05,t.car);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.length)).toBeGreaterThan(6);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const budget=await page.evaluate(()=>{const t=(window as any).__gameTest;return {agents:t.traffic.sim.agents.length,capacity:t.traffic.sim.capacity,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles};});
 expect(budget.capacity).toBe(18);expect(budget.agents).toBeLessThanOrEqual(18);expect(budget.calls).toBeLessThan(350);expect(budget.triangles).toBeLessThan(200000);console.log('High traffic render budget:',JSON.stringify(budget));
});
