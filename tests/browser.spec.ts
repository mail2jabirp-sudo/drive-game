import {test,expect} from '@playwright/test';
import {instrument,start,stoppedAt,interact} from './helpers/game';
const key='kottakkal-drive.v1';

test('the only world starts by default and retains driving, steering, reverse, horn, pause and reset',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);
 await expect(page.locator('#world-select')).toHaveCount(0);await expect(page.locator('#change-area')).toHaveCount(0);
 await expect(page.locator('.practice-notice')).toContainText('partial coverage');
 await expect(page.locator('#mission-title')).toHaveText('Malappuram District fare');
 const spawn=await page.evaluate(()=>({...((window as any).__gameTest.car)}));
 await page.keyboard.down('KeyW');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(8);
 await page.keyboard.down('KeyA');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.car.steering)).toBeGreaterThan(0.1);
 await page.keyboard.up('KeyA');await page.keyboard.up('KeyW');await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
 await page.keyboard.press('KeyH');await page.keyboard.press('KeyP');await expect(page.locator('#pause-button')).toHaveAttribute('aria-label','Resume game');
 await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');await expect(page.locator('#speed')).toHaveText('0');
 await page.locator('#pause-button').click();await page.keyboard.press('KeyR');
 await page.keyboard.down('KeyS');await expect.poll(()=>page.evaluate(()=>(window as any).__gameTest.car.speed)).toBeLessThan(-1);
 await page.keyboard.up('KeyS');await page.keyboard.press('KeyR');await expect(page.locator('#speed')).toHaveText('0');
 const reset=await page.evaluate(()=>(window as any).__gameTest.car);expect(reset.x).toBeCloseTo(spawn.x);expect(reset.z).toBeCloseTo(spawn.z);
 await page.screenshot({path:'test-results/district-desktop.png'});expect(errors).toEqual([]);
});

test('legacy practice progress remains archived while its wallet and passenger continue in the district',async({page})=>{
 const old={version:1,money:240,trips:2,teaBreaks:1,phase:'dropoff',x:72,z:-12,heading:0};
 await page.addInitScript(p=>{if(!localStorage.getItem('kottakkal-drive.v1')){localStorage.setItem('kottakkal-drive.v1',JSON.stringify(p));localStorage.setItem('en3d.world.v1','practice');}},old);
 await instrument(page);await start(page,'/?world=practice');await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 const stop=await page.evaluate(()=>(window as any).__gameTest.streamed.world.dropoff);await stoppedAt(page,stop);await interact(page);
 await expect(page.locator('#money')).toHaveText('₹360');await page.reload();await page.locator('#start-button').click();await expect(page.locator('#money')).toHaveText('₹360');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 expect(saved.x).toBe(old.x);expect(saved.z).toBe(old.z);expect(saved.phase).toBe(old.phase);expect(saved.teaBreaks).toBe(1);expect(saved.exportRide.phase).toBe('pickup');
});

test('mobile pedals and steering remain usable in landscape and portrait without a map selector',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:0.75,isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await instrument(page);await start(page);
  const bounds=(await page.locator('[data-control="throttle"]').boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
  await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(5);await page.mouse.up();await page.locator('#reset-button').tap();
  await expect(page.locator('[data-control="left"]')).toBeVisible();await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#world-select')).toHaveCount(0);
  await page.screenshot({path:'test-results/district-mobile.png'});
 }finally{await context.close();}
});

test('tea interaction is reused near a mapped cafe and preserves wallet, passenger and saved counters',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('kottakkal-drive.v1'))localStorage.setItem('kottakkal-drive.v1',JSON.stringify({version:1,money:120,trips:1,teaBreaks:0,phase:'dropoff',x:72,z:36,heading:0}));});
 await instrument(page);await start(page);
 const stop=await page.evaluate(()=>(window as any).__gameTest.streamed.world.tea);expect(stop).toBeTruthy();await stoppedAt(page,stop);
 await expect(page.locator('#tea-panel')).toBeVisible();await page.locator('#tea-button').click();await expect(page.locator('#money')).toHaveText('₹110');
 await expect(page.locator('#tea-count')).toHaveText('1 tea break enjoyed');await expect(page.locator('#mission-title')).toHaveText('Passenger aboard');
 await page.reload();await page.locator('#start-button').click();await expect(page.locator('#money')).toHaveText('₹110');await expect(page.locator('#tea-count')).toHaveText('1 tea break enjoyed');
});
