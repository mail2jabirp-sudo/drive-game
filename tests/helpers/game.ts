import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
export async function instrument(page:Page){
 await page.addInitScript(()=>localStorage.setItem('en3d.display.v1','low'));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),source=await response.text();
  await route.fulfill({response,body:source.replace('renderer.render(scene, camera);','renderer.render(scene, camera); window.__gameTest={car,streamed,camera,renderer,scene,input,traffic,audio,get navigation(){return {route:navRoute,revision:navRevision};},get elapsed(){return elapsed;},get lastInteraction(){return lastInteraction;}};')});
 });
}
export async function start(page:Page,path='/'){
 await page.goto(path);await expect(page.locator('#start-button')).toBeEnabled();await page.locator('#start-button').click();
 await expect(page.locator('#fatal-error')).toBeHidden();await expect(page.locator('#start-screen')).toBeHidden();
}
export async function stoppedAt(page:Page,point:{x:number;z:number}){
 await page.evaluate(async p=>{const t=(window as any).__gameTest;t.car.speed=0;t.input.clear();await t.streamed.world.refresh(p);Object.assign(t.car,p);t.camera.position.x=p.x;t.camera.position.z=p.z;},point);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await expect(page.locator('#speed')).toHaveText('0');
}
export async function interact(page:Page){
 await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__gameTest;return t.elapsed-t.lastInteraction;})).toBeGreaterThanOrEqual(1);
 await page.keyboard.press('KeyE');
}
