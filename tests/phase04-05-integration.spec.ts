import {test,expect} from '@playwright/test';
import {instrument,start} from './helpers/game';
test('active district world combines road PBR with newer architecture and preserves its source projection',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);
 const proof=await page.evaluate(()=>{
  const t=(window as any).__gameTest;let roads=0,architecture=0;const materialNames=new Set<string>();
  t.scene.traverseVisible((o:any)=>{if(!o.isMesh)return;const m=o.material;if(m.name?.startsWith('Integrated road ')){roads++;materialNames.add(m.name);if(!m.map||!m.bumpMap||!m.roughnessMap)throw new Error('Road PBR channels missing');}if(o.userData.architectureLod)architecture++;});
  return {roads,architecture,materials:[...materialNames],projection:t.streamed.manifest.projection,source:t.streamed.data.source.sha256,resident:t.streamed.world.streaming.resident,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z)};
 });
 expect(proof.roads).toBeGreaterThan(0);expect(proof.architecture).toBeGreaterThan(0);expect(proof.projection.latitude).toBe(11.0544807);expect(proof.projection.longitude).toBe(76.0863541);expect(proof.resident).toBeLessThanOrEqual(9);expect(proof.onRoad).toBe(true);expect(proof.calls).toBeLessThan(350);expect(proof.triangles).toBeLessThan(200000);expect(errors).toEqual([]);console.log('Integrated source/PBR proof:',JSON.stringify(proof));
 await page.screenshot({path:'evidence/phase04-05-integration/active-world.png'});
});
