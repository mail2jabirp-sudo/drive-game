import {test,expect} from '@playwright/test';import {instrument,start} from './helpers/game';
test('Phase 06 architecture remains batched through district streaming and preserves the existing HUD',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await start(page);
 const proof=await page.evaluate(async()=>{const t=(window as any).__gameTest;t.traffic.sim.clear();t.traffic.sim.spawning=false;const origin={x:t.car.x,z:t.car.z};let maxResident=0;const snapshots=[];
  for(const p of [origin,{x:origin.x-620,z:origin.z},origin]){await t.streamed.world.refresh(p);maxResident=Math.max(maxResident,t.streamed.world.streaming.resident);snapshots.push([...t.streamed.data.buildings].sort((a:any,b:any)=>a.id.localeCompare(b.id)).map((b:any)=>[b.id,b.points]));}
  const materials=new Set<string>();let meshes=0;t.scene.traverse((o:any)=>{if(o.isMesh&&o.material?.name?.startsWith('Architectural')){materials.add(o.material.name);meshes++;}});return {maxResident,roundTrip:JSON.stringify(snapshots[0])===JSON.stringify(snapshots[2]),materials:[...materials],meshes};});
 expect(proof.maxResident).toBeLessThanOrEqual(9);expect(proof.roundTrip).toBe(true);expect(proof.materials.length).toBeLessThanOrEqual(8);expect(proof.meshes).toBeLessThan(1200);
 await expect(page.locator('#money')).toHaveText('₹0');await expect(page.locator('#minimap')).toBeVisible();expect(errors).toEqual([]);
});
