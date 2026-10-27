import {test,expect} from '@playwright/test';
import {instrument,start,stoppedAt} from './helpers/game';

test('actual driving crosses a connected mapped junction and keeps the player on rendered pavement',async({page})=>{
 await instrument(page);await start(page);
 const junction=await page.evaluate(()=>{
  const t=(window as any).__gameTest,sim=t.traffic.sim;
  for(const id of sim.junctions){if(!/^\d+$/.test(id))continue;
   const incoming=[...sim.edges.values()].filter((e:any)=>e.to===id&&e.length>15&&e.road.width>=6);
   for(const e of incoming as any[]){
    const next=sim.outgoing.get(id)?.find((n:any)=>n.to!==e.from&&n.length>40&&n.road.width>=6&&e.dx*n.dx+e.dz*n.dz>.999);
    if(!next)continue;const point={x:e.b.x-e.dx*9,z:e.b.z-e.dz*9,heading:Math.atan2(-e.dx,-e.dz)};
    if(t.streamed.world.isBlocked(point.x,point.z))continue;
    return {point,node:{x:e.b.x,z:e.b.z},id,outgoing:sim.outgoing.get(id).length};
   }
  }
 });expect(junction).toBeTruthy();expect(junction!.outgoing).toBeGreaterThan(1);await stoppedAt(page,junction!.point);
 await page.evaluate(p=>{const t=(window as any).__gameTest;t.car.heading=p.heading;t.traffic.sim.clear();t.traffic.sim.enabled=false;},junction!.point);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(p=>{const c=(window as any).__gameTest.car;return -(c.x-p.x)*Math.sin(p.heading)-(c.z-p.z)*Math.cos(p.heading);},junction!.point)).toBeGreaterThan(20);
 await page.keyboard.up('KeyW');await page.keyboard.down('Space');await expect(page.locator('#speed')).toHaveText('0');await page.keyboard.up('Space');
 const result=await page.evaluate(node=>{const t=(window as any).__gameTest;
  const ray=new t.THREE.Raycaster(new t.THREE.Vector3(t.car.x,20,t.car.z),new t.THREE.Vector3(0,-1,0));
  const renderedPavement=ray.intersectObjects(t.scene.children,true).some((hit:any)=>{
   if(hit.point.y<.03||hit.point.y>.08)return false;let object=hit.object;
   while(object){if(!object.visible)return false;if(object.name==='OSM Kottakkal source geometry')return true;object=object.parent;}return false;
  });
  return {renderedPavement,car:{...t.car},onRoad:t.streamed.world.roadSurface(t.car.x,t.car.z),blocked:t.streamed.world.isBlocked(t.car.x,t.car.z),junctionStillConnected:t.traffic.sim.junctions.has(node)};},junction!.id);
 expect(result.renderedPavement).toBe(true);expect(result.onRoad).toBe(true);expect(result.blocked).toBe(false);expect(result.junctionStillConnected).toBe(true);console.log('Driven source junction:',JSON.stringify({junction,result}));await page.screenshot({path:'test-results/driven-junction.png'});
});
