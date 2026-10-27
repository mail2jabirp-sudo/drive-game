import {test,expect} from '@playwright/test';
import {instrument,start,stoppedAt,interact} from './helpers/game';

test('first hatchback prototype drives in the sole world, animates and persists selection without changing map or wallet',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto('/');await expect(page.locator('#start-button')).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().state)).toBe('uninitialized');
 const labels=await page.locator('#vehicle-select option').allTextContents();expect(labels[0]).toContain('Maruti');expect(labels[1]).toContain('pickup');expect(labels[2]).toContain('KSRTC');expect(labels[3]).toContain('autorickshaw');
 expect(await page.locator('#vehicle-select option:disabled').count()).toBe(2);
 await page.locator('#vehicle-select').selectOption('maruti800');await page.locator('#start-button').click();await expect(page.locator('#mission-title')).toHaveText('Free driving');
 await expect(page.locator('#world-select')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().state)).toBe('running');
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().frequency)).toBeLessThan(40);
 const before=await page.evaluate(()=>{const t=(window as any).__gameTest;return {wheel:t.rickshaw.group.getObjectByName('Rotating wheel').rotation.x,map:t.streamed.manifest.source.sha256,frequency:t.audio.diagnostics().frequency};});
 await page.keyboard.down('KeyW');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(8);await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>{const t=(window as any).__gameTest;return {wheel:t.rickshaw.group.getObjectByName('Rotating wheel').rotation.x,frequency:t.audio.diagnostics().frequency,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles};});
 expect(after.wheel).not.toBe(before.wheel);expect(after.frequency).toBeGreaterThan(before.frequency);expect(after.calls).toBeLessThan(350);expect(after.triangles).toBeLessThan(200000);
 await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
 await page.locator('#display-settings summary').click();await page.locator('#headlights-button').click();await page.locator('#indicator-select').selectOption('hazard');
 await expect.poll(()=>page.evaluate(()=>{let power=0;(window as any).__gameTest.rickshaw.group.traverse((o:any)=>{if(o.isSpotLight)power+=o.intensity;});return power;})).toBeGreaterThan(0);
 await page.locator('#display-settings summary').click();await page.screenshot({path:'test-results/maruti-prototype.png'});
 await page.reload();await page.locator('#start-button').click();await expect(page.locator('#mission-title')).toHaveText('Free driving');
 const saved=await page.evaluate(()=>{const t=(window as any).__gameTest;return {vehicle:JSON.parse(localStorage.getItem('kottakkal-drive.v1')!).vehicleId,map:t.streamed.manifest.source.sha256};});expect(saved.vehicle).toBe('maruti800');expect(saved.map).toBe(before.map);expect(errors).toEqual([]);
});

test('audio produces a signal, responds to throttle, supports mute/volume and caps sound voices across switches',async({page})=>{
 await instrument(page);await start(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeGreaterThan(0.00001);
 await page.locator('#sound-button').click();await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeLessThan(0.000001);
 await page.locator('#sound-button').click();await page.locator('#display-settings summary').click();
 await page.locator('#audio-volume').evaluate((el:HTMLInputElement)=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeLessThan(0.000001);
 await page.locator('#audio-volume').evaluate((el:HTMLInputElement)=>{el.value='0.5';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().rms)).toBeGreaterThan(0.00001);
 for(let i=0;i<4;i++){await page.locator('#vehicle-select-game').selectOption('maruti800');await page.locator('#vehicle-select-game').selectOption('passenger-auto');}
 const state=await page.evaluate(()=>(window as any).__gameTest.audio.diagnostics());expect(state.engineVoices).toBe(1);expect(state.transients).toBeLessThanOrEqual(6);
 await page.locator('#display-settings summary').click();await page.keyboard.press('KeyH');await page.reload();await page.locator('#start-button').click();
 expect(await page.evaluate(()=>(window as any).__gameTest.audio.diagnostics().volume)).toBe(0.5);
});

test('switching vehicles cannot lose a passenger fare and auto missions still pay after free driving',async({page})=>{
 await instrument(page);await start(page);await interact(page);await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 await page.locator('#display-settings summary').click();await page.locator('#vehicle-select-game').selectOption('maruti800');await expect(page.locator('#vehicle-select-game')).toHaveValue('passenger-auto');
 await page.locator('#display-settings summary').click();const stop=await page.evaluate(()=>(window as any).__gameTest.streamed.world.dropoff);await stoppedAt(page,stop);await interact(page);await expect(page.locator('#money')).toHaveText('₹120');
 await page.locator('#display-settings summary').click();await page.locator('#vehicle-select-game').selectOption('maruti800');await page.locator('#display-settings summary').click();await expect(page.locator('#mission-title')).toHaveText('Free driving');
 await expect(page.locator('#money')).toHaveText('₹120');await page.locator('#display-settings summary').click();await page.locator('#vehicle-select-game').selectOption('passenger-auto');await page.locator('#display-settings summary').click();await expect(page.locator('#mission-title')).toHaveText('Malappuram District fare');
});

test('compact car touch throttle, steering and reset work on a mobile viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:0.75,isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await instrument(page);await page.goto('/');await expect(page.locator('#start-button')).toBeEnabled();await page.locator('#vehicle-select').selectOption('maruti800');await page.locator('#start-button').tap();
  const box=(await page.locator('[data-control="throttle"]').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(5);await page.mouse.up();
  await page.locator('#reset-button').tap();await expect(page.locator('#speed')).toHaveText('0');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('[data-control="left"]')).toBeVisible();await page.screenshot({path:'test-results/maruti-mobile.png'});
 }finally{await context.close();}
});
