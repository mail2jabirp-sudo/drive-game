import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const root='evidence/interface-redesign/',baseline=JSON.parse(readFileSync(root+'comparison.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
async function pageWithProbe(saved){
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(save=>{localStorage.setItem('en3d.display.v1','low');if(save)localStorage.setItem('kottakkal-drive.v1',save);},saved);
 await page.route('**/src/main.ts*',async r=>{const response=await r.fetch(),source=await response.text();await r.fulfill({response,body:source.replace('renderer.render(scene, camera);',`if(window.__fixedComparison){const s=window.__fixedComparison;Object.assign(car,s.car);traffic.sim.enabled=false;traffic.sim.agents.splice(0,traffic.sim.agents.length,...s.traffic.map(a=>({...a})));traffic.update(0,car,true,false);camera.position.fromArray(s.camera.position);camera.quaternion.fromArray(s.camera.quaternion);camera.fov=s.camera.fov;camera.updateProjectionMatrix();} renderer.render(scene, camera);window.__capture={car,camera,traffic,streamed,renderer,rickshaw};`)});});
 await page.goto(process.env.EN3D_PREVIEW_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);return page;
}
try{
 const page=await pageWithProbe();await page.waitForTimeout(4000);await page.screenshot({path:root+'menu-after.png'});
 await page.locator('#start-screen [data-panel="vehicles"]').click();await page.screenshot({path:root+'vehicles.png'});await page.locator('#vehicles-dialog [data-close]').click();
 await page.locator('#start-button').click();await page.waitForTimeout(4300);await page.screenshot({path:root+'game-new-chase.png'});
 await page.keyboard.press('KeyC');await page.waitForTimeout(500);await page.screenshot({path:root+'driver-camera.png'});await page.keyboard.press('KeyC');
 await page.locator('#display-settings').click();await page.screenshot({path:root+'settings.png'});await page.locator('#settings-dialog [data-close]').last().click();await page.waitForFunction(()=>document.querySelector('#pause-screen').hidden);
 await page.keyboard.press('KeyP');await page.locator('#pause-screen').waitFor({state:'visible'});await page.screenshot({path:root+'pause.png'});await page.locator('#resume-button').click();
 const stats=await page.evaluate(()=>{const t=window.__capture;let meshes=0;t.rickshaw.group.traverse(o=>{if(o.isMesh)meshes++;});return {drawCalls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,playerMeshes:meshes,residentTiles:t.streamed.world.streaming.resident};});
 await page.close();
 const compare=await pageWithProbe(baseline.save);await compare.locator('#start-button').click();await compare.waitForTimeout(4400);await compare.evaluate(state=>window.__fixedComparison=state,baseline);await compare.waitForTimeout(150);await compare.screenshot({path:root+'game-after-same-camera.png'});
 const actual=await compare.evaluate(()=>({car:{...window.__capture.car},position:window.__capture.camera.position.toArray(),quaternion:window.__capture.camera.quaternion.toArray(),fov:window.__capture.camera.fov}));
 if(JSON.stringify(actual.position)!==JSON.stringify(baseline.camera.position)||JSON.stringify(actual.quaternion)!==JSON.stringify(baseline.camera.quaternion)||actual.fov!==baseline.camera.fov)throw new Error('Comparison camera changed');
 if(actual.car.x!==baseline.car.x||actual.car.z!==baseline.car.z)throw new Error('Comparison pose changed');
 if(errors.length)throw new Error(errors.join('\n'));
 writeFileSync(root+'verification.json',JSON.stringify({cameraMatched:true,poseMatched:true,quality:'low',viewport:[1440,900],...stats,runtimeErrors:errors},null,2)+'\n');
 console.log(JSON.stringify({cameraMatched:true,poseMatched:true,...stats,runtimeErrors:errors}));
}finally{await browser.close();}
