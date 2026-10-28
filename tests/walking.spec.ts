import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';import {instrument,start,interact,stoppedAt} from './helpers/game';

test('exit, walk, run, save, reload and enter preserve the parked auto, passenger and wallet',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);await interact(page);await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 const parked=await page.evaluate(()=>({...((window as any).__gameTest.car)}));await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.car.speed)).toBeGreaterThan(1);await page.keyboard.press('KeyF');expect(await page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('driving');await page.keyboard.up('KeyW');await page.keyboard.press('KeyR');
 await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');await expect(page.locator('#vehicle-label')).toHaveText('ON FOOT');
 const exit=await page.evaluate(()=>{const t=(window as any).__gameTest;return {pose:{...t.foot.pose},visible:t.character.group.visible,seated:t.rickshaw.group.getObjectByName('Seated player driver').visible};});expect(exit.visible).toBe(true);expect(exit.seated).toBe(false);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.pose.speed)).toBeGreaterThan(1.5);await page.keyboard.down('ShiftLeft');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.pose.speed)).toBeGreaterThan(3.7);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyP');const before=await page.evaluate(()=>{const t=(window as any).__gameTest;return {pose:{...t.foot.pose},car:{...t.car},save:JSON.parse(localStorage.getItem('kottakkal-drive.v1')!)};});expect(before.car.x).toBeCloseTo(parked.x,3);expect(before.car.z).toBeCloseTo(parked.z,3);expect(before.car.speed).toBe(0);expect(before.pose.speed).toBe(0);expect(before.save.exportRide.phase).toBe('dropoff');expect(before.save.money).toBe(0);expect(before.save.onFoot.x).toBeCloseTo(before.pose.x,3);
 await page.reload();await expect(page.locator('#continue-button')).toBeEnabled();await page.locator('#continue-button').click();await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');
 const restored=await page.evaluate(()=>(window as any).__gameTest.foot.pose);expect(restored.x).toBeCloseTo(before.pose.x,3);expect(restored.z).toBeCloseTo(before.pose.z,3);
 // An on-foot destination cannot complete a passenger trip remotely.
 const destination=await page.evaluate(()=>{const t=(window as any).__gameTest;return t.streamed.world.dropoff;});await page.evaluate(async p=>{const t=(window as any).__gameTest;await t.streamed.world.refresh(p);Object.assign(t.foot.pose,p,{speed:0});},destination);await page.keyboard.press('KeyE');await expect(page.locator('#money')).toHaveText('₹0');
 await page.evaluate(async p=>{const t=(window as any).__gameTest;await t.streamed.world.refresh(t.car);Object.assign(t.foot.pose,p,{speed:0});t.camera.position.x=p.x;t.camera.position.z=p.z;},exit.pose);
 await page.waitForTimeout(200);await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('driving');expect(await page.evaluate(()=>(window as any).__gameTest.rickshaw.group.getObjectByName('Seated player driver').visible)).toBe(true);
 await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');await stoppedAt(page,destination);await interact(page);await expect(page.locator('#money')).toHaveText('₹120');expect(errors).toEqual([]);
});

test('on-foot collisions reject car interiors and buildings; camera stays third-person and source boards are absent',async({page})=>{
 await instrument(page);await start(page);await page.keyboard.press('KeyC');await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');
 const check=await page.evaluate(()=>{const t=(window as any).__gameTest,b=t.streamed.data.buildings[0],p=b.points[0];return {car:t.footBlocked(t.car),building:t.footBlocked(p),boards:t.scene.children.flatMap((o:any)=>{const found:any[]=[];o.traverse((a:any)=>{if(a.name?.startsWith('OSM landmark label'))found.push(a.name);});return found;}).length};});expect(check.car).toBe(true);expect(check.building).toBe(true);expect(check.boards).toBe(0);
 await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__gameTest;return t.camera.position.y-t.streamed.world.heightAt(t.foot.pose.x,t.foot.pose.z);})).toBeGreaterThan(2.5);
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');await page.keyboard.press('KeyC');
 await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__gameTest,target=new t.THREE.Vector3(t.foot.pose.x,1.3,t.foot.pose.z),direction=target.clone().sub(t.camera.position),distance=direction.length(),ray=new t.THREE.Ray(t.camera.position.clone(),direction.normalize()),box=new t.THREE.Box3().setFromObject(t.rickshaw.group),hit=ray.intersectBox(box,new t.THREE.Vector3());return !hit||t.camera.position.distanceTo(hit)>=distance-.25;})).toBe(true);
 await page.waitForTimeout(500);await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'test-results/on-foot-gameplay.png'});
 const budget=await page.evaluate(()=>{const t=(window as any).__gameTest;return {calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,resident:t.streamed.world.streaming.resident};});expect(budget.calls).toBeLessThan(350);expect(budget.resident).toBeLessThanOrEqual(9);console.log('On-foot budget:',JSON.stringify(budget));
 const pose=await page.evaluate(()=>({...((window as any).__gameTest.foot.pose)}));await page.keyboard.press('KeyP');await page.locator('#menu-button').click();await expect(page.locator('#start-button')).toContainText('CONTINUE ON FOOT');await page.locator('#start-screen [data-panel=vehicles]').click();await expect(page.locator('#drive-auto')).toContainText('CONTINUE ON FOOT');await page.locator('#drive-auto').click();
 expect(await page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');const after=await page.evaluate(()=>(window as any).__gameTest.foot.pose);expect(after.x).toBeCloseTo(pose.x,3);expect(after.z).toBeCloseTo(pose.z,3);
});

test('touch exit and held RUN work without driving the parked vehicle',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});try{const page=await context.newPage();await instrument(page);await start(page);await page.locator('#vehicle-action').tap();await expect(page.locator('#vehicle-label')).toHaveText('ON FOOT');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');
  await expect(page.locator('[data-control=handbrake]')).toHaveText('RUN');const throttle=(await page.locator('[data-control=throttle]').boundingBox())!;await page.mouse.move(throttle.x+throttle.width/2,throttle.y+throttle.height/2);await page.mouse.down();await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.pose.speed)).toBeGreaterThan(1.5);await page.mouse.up();
  const run=(await page.locator('[data-control=handbrake]').boundingBox())!,cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:throttle.x+throttle.width/2,y:throttle.y+throttle.height/2,id:1},{x:run.x+run.width/2,y:run.y+run.height/2,id:2}]});
  await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.pose.speed)).toBeGreaterThan(3.7);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>(window as any).__gameTest.car.speed)).toBe(0);await page.screenshot({path:'test-results/on-foot-mobile.png'});
 }finally{await context.close();}
});


test('off-road walking GPS marks a verified road entry and gives its real distance',async({page})=>{
 await instrument(page);await start(page);await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');
 const point=await page.evaluate(()=>{const t=(window as any).__gameTest;for(const x of [-20,20,-35,35])for(const z of [-20,20,-35,35]){const p={x:t.car.x+x,z:t.car.z+z},route=t.navigator.route(p,t.car);if(!t.footBlocked(p)&&route.available&&route.offRoad){Object.assign(t.foot.pose,p,{speed:0});return p;}}});expect(point).toBeTruthy();
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.scene.getObjectByName('GPS verified road entry').visible)).toBe(true);
 await expect(page.locator('#gps-instruction')).toContainText('ring');await expect(page.locator('#gps-distance')).toContainText(/auto|hatchback|taxi|van/);
 const proof=await page.evaluate(()=>{const t=(window as any).__gameTest,p=t.navigation.route.points[0],ring=t.scene.getObjectByName('GPS verified road entry');return {error:Math.hypot(p.x-ring.position.x,p.z-ring.position.z),onRoad:t.streamed.world.roadSurface(p.x,p.z),distance:Math.hypot(t.foot.pose.x-p.x,t.foot.pose.z-p.z)};});expect(proof.error).toBeLessThan(.01);expect(proof.onRoad).toBe(true);expect(proof.distance).toBeGreaterThan(6);
 for(let n=0;n<8;n++){
  const inside=await page.evaluate(()=>{const t=(window as any).__gameTest,p=t.scene.getObjectByName('GPS verified road entry').position.clone().project(t.camera);return Math.abs(p.x)<.9&&Math.abs(p.y)<.85&&p.z>0&&p.z<1;});if(inside)break;await page.keyboard.press('KeyC');await page.waitForTimeout(500);
 }
 expect(await page.evaluate(()=>{const t=(window as any).__gameTest,p=t.scene.getObjectByName('GPS verified road entry').position.clone().project(t.camera);return Math.abs(p.x)<.9&&Math.abs(p.y)<.85&&p.z>0&&p.z<1;})).toBe(true);
 await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'test-results/on-foot-road-entry.png'});
});

test('walking save restores a different real tile window without relocating the parked vehicle',async({page})=>{
 const m=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8')),tile=JSON.parse(readFileSync('public/maps/district/'+m.tiles['2,0'].file,'utf8'));const point=tile.roads.flatMap((r:any)=>r.points).find((p:any)=>p.x>1250&&p.x<1700&&p.z>20&&p.z<580);
 await instrument(page);await start(page);const parked=await page.evaluate(()=>({...((window as any).__gameTest.car)}));await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');
 await page.evaluate(async p=>{const t=(window as any).__gameTest;await t.streamed.world.refresh(p);Object.assign(t.foot.pose,p,{speed:0});t.camera.position.x=p.x;t.camera.position.z=p.z;},point);await page.waitForTimeout(200);await page.keyboard.press('KeyP');
 await page.reload();await page.locator('#continue-button').click();await expect(page.locator('#vehicle-label')).toHaveText('ON FOOT');
 const restored=await page.evaluate(()=>{const t=(window as any).__gameTest;return {car:{...t.car},foot:{...t.foot.pose},blocked:t.footBlocked(t.foot.pose),tiles:t.streamed.world.streaming.resident,keys:t.streamed.world.streaming.keys};});
 expect(restored.car.x).toBeCloseTo(parked.x,3);expect(restored.car.z).toBeCloseTo(parked.z,3);expect(restored.foot.x).toBeCloseTo(point.x,3);expect(restored.foot.z).toBeCloseTo(point.z,3);expect(restored.blocked).toBe(false);expect(restored.tiles).toBeLessThanOrEqual(9);expect(restored.keys).toContain('2,0');
});


test('vehicle-only tea controls hide while walking and return after entering',async({page})=>{
 await instrument(page);await start(page);const tea=await page.evaluate(()=>(window as any).__gameTest.streamed.world.tea);await stoppedAt(page,tea);await expect(page.locator('#tea-panel')).toBeVisible();await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('walking');await expect(page.locator('#tea-panel')).toBeHidden();
 await page.keyboard.press('KeyP');expect(await page.evaluate(()=>(window as any).__gameTest.foot.pose.speed)).toBe(0);await page.locator('#resume-button').click();await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.foot.mode)).toBe('driving');await expect(page.locator('#tea-panel')).toBeVisible();
});
