import {test,expect} from '@playwright/test';
import {instrument,start} from './helpers/game';

test('cinematic menu has live source-road traffic, keyboard-accessible actions and honest vehicle availability',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto('/');await expect(page.locator('#start-button')).toBeEnabled();await expect(page.locator('#continue-button')).toBeDisabled();
 await expect(page.locator('.welcome-stamp')).toHaveCount(0);await expect(page.locator('.project-subtitle')).toHaveText('Kerala Open World Simulator');
 const first=await page.evaluate(()=>{const t=(window as any).__gameTest;return {camera:t.camera.position.toArray(),car:{...t.car}};});
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.traffic.sim.agents.some((a:any)=>a.distance>1))).toBe(true);
 const second=await page.evaluate(()=>{const t=(window as any).__gameTest;return {camera:t.camera.position.toArray(),car:{...t.car}};});expect(second.camera).not.toEqual(first.camera);expect(second.car.x).toBe(first.car.x);expect(second.car.z).toBe(first.car.z);
 await page.locator('#start-screen [data-panel="controls"]').click();await expect(page.locator('#controls-dialog')).toBeVisible();await expect(page.locator('#controls-dialog')).toContainText('Change camera');await page.keyboard.press('Escape');await expect(page.locator('#controls-dialog')).not.toBeVisible();
 await page.locator('#start-screen [data-panel="vehicles"]').click();await expect(page.locator('#vehicles-dialog')).toBeVisible();await expect(page.locator('#vehicles-dialog')).toContainText('not available yet');await page.locator('#vehicles-dialog [data-close]').click();
 await page.locator('#start-button').focus();await page.keyboard.press('Space');await expect(page.locator('#start-screen')).toBeHidden();expect(errors).toEqual([]);
});

test('real graphics/audio settings pause driving and resume safely; cameras, directions and brake lights work',async({page})=>{
 await instrument(page);await start(page);await page.locator('#display-settings').click();await expect(page.locator('#settings-dialog')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__gameTest.paused)).toBe(true);
 for(const [mode,size,shadows] of [['medium',512,true],['high',1024,true],['low',1024,false]] as const){
  await page.locator('#quality-select').focus();await page.locator('#quality-select').selectOption(mode);await expect(page.locator('#quality-select')).toBeFocused();
  const actual=await page.evaluate(()=>{const t=(window as any).__gameTest;let size=0;t.scene.traverse((o:any)=>{if(o.isDirectionalLight)size=o.shadow.mapSize.x;});return {mode:t.graphics.mode,shadows:t.renderer.shadowMap.enabled,size,saved:localStorage.getItem('en3d.display.v1')};});
  expect(actual.mode).toBe(mode);expect(actual.size).toBe(size);expect(actual.shadows).toBe(shadows);expect(actual.saved).toBe(mode);
 }
 await page.locator('#settings-mute').click();await expect(page.locator('#settings-mute')).toHaveText('Enable audio');await page.locator('#settings-mute').click();
 const clock=await page.evaluate(()=>(window as any).__gameTest.traffic.sim.clock);await page.keyboard.press('KeyW');await page.waitForTimeout(250);expect(await page.evaluate(()=>(window as any).__gameTest.traffic.sim.clock)).toBe(clock);
 await page.locator('#settings-dialog [data-close]').last().click();await expect(page.locator('#pause-screen')).toBeHidden();await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.paused)).toBe(false);
 await page.keyboard.press('KeyC');await expect(page.locator('#camera-button')).toHaveAttribute('aria-label','Switch to chase camera');
 await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__gameTest;return t.camera.position.y-t.streamed.world.heightAt(t.car.x,t.car.z);})).toBeLessThan(2);
 await page.screenshot({path:'test-results/interface-driver-camera.png'});await page.keyboard.press('KeyC');await expect(page.locator('#camera-button')).toHaveAttribute('aria-label','Switch to driver camera');
 await page.keyboard.down('KeyW');await expect(page.locator('#drive-gear')).toHaveText('D');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(6);
 const mesh=await page.evaluate(()=>{const t=(window as any).__gameTest;let count=0,wheels=0,rotation=false;t.rickshaw.group.traverse((o:any)=>{if(o.isMesh)count++;if(o.name==='Rolling wheel'){wheels++;rotation ||= Math.abs(o.rotation.x)>.01;}});return {count,wheels,rotation};});expect(mesh.count).toBeLessThan(40);expect(mesh.wheels).toBe(3);expect(mesh.rotation).toBe(true);
 await page.keyboard.up('KeyW');await page.keyboard.down('KeyS');await expect.poll(()=>page.evaluate(()=>{let intensity=0;(window as any).__gameTest.rickshaw.group.traverse((o:any)=>{if(o.material?.name==='Autorickshaw brake lights')intensity=o.material.emissiveIntensity;});return intensity;})).toBeGreaterThan(1);
 await page.keyboard.up('KeyS');await page.keyboard.press('KeyR');await page.keyboard.down('KeyS');await expect(page.locator('#drive-gear')).toHaveText('R');await page.keyboard.up('KeyS');await page.keyboard.press('KeyR');
 await page.keyboard.press('KeyP');await expect(page.locator('#pause-screen')).toBeVisible();await page.locator('#menu-button').click();await expect(page.locator('#start-screen')).toBeVisible();await expect(page.locator('#continue-button')).toBeEnabled();await page.locator('#continue-button').click();await expect(page.locator('#start-screen')).toBeHidden();
});

test('Continue keeps an existing passenger and wallet; mobile cards avoid the driving controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:568,height:320},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 try{const page=await context.newPage();await page.addInitScript(()=>{if(!localStorage.getItem('kottakkal-drive.v1'))localStorage.setItem('kottakkal-drive.v1',JSON.stringify({version:1,money:360,trips:3,phase:'dropoff',x:72,z:36,heading:0}));});await instrument(page);await page.goto('/');await expect(page.locator('#continue-button')).toBeEnabled();
  const cta=await page.locator('#start-button').boundingBox();expect(cta!.y).toBeGreaterThan(0);expect(cta!.y+cta!.height).toBeLessThan(320);
  await page.screenshot({path:'test-results/interface-mobile-menu.png'});await page.locator('#continue-button').click();await expect(page.locator('#money')).toHaveText('₹360');await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
  for(const [width,height] of [[568,320],[844,390],[390,844]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.waitForTimeout(150);
   const boxes=await page.evaluate(()=>{const box=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {mission:box('.mission-panel'),map:box('.map-panel'),pedals:box('.touch-pedals'),steering:box('.touch-steering'),overflow:document.documentElement.scrollWidth>innerWidth};});
   const overlaps=(a:any,b:any)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
   expect(boxes.overflow).toBe(false);expect(overlaps(boxes.mission,boxes.pedals)).toBe(false);expect(overlaps(boxes.mission,boxes.steering)).toBe(false);expect(overlaps(boxes.map,boxes.steering)).toBe(false);await expect(page.locator('[data-control="throttle"]')).toBeVisible();
   await page.screenshot({path:`test-results/interface-mobile-${width}.png`});
  }
 }finally{await context.close();}
});
