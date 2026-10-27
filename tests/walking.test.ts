import {test} from 'node:test';import assert from 'node:assert/strict';
import {WalkingController,readFootSave} from '../src/walking';
import {serializeRouteProgress} from '../src/route-save';import {newProgress} from '../src/progress';
const car={x:0,z:0,heading:0,speed:0};
const advance=(w:WalkingController,seconds:number,input={forward:false,back:false,left:false,right:false,run:false})=>{for(let t=0;t<seconds;t+=.05)w.update(.05,input);};
test('exit and entry require a stopped nearby vehicle and have bounded smooth transitions',()=>{
 const w=new WalkingController(()=>false);assert.equal(w.exit({...car,speed:1}),'moving');assert.equal(w.mode,'driving');assert.equal(w.exit(car),'ok');assert.equal(w.mode,'exiting');w.update(.1,{forward:true,back:false,left:false,right:false,run:true});assert.ok(w.pose.x<0&&w.pose.x>-2);assert.equal(w.pose.z,0);advance(w,.6);assert.equal(w.mode,'walking');assert.equal(w.pose.x,-2);
 w.pose.x=-8;assert.equal(w.enter(car),'far');assert.equal(w.mode,'walking');w.pose.x=-2;assert.equal(w.enter(car),'ok');advance(w,.6);assert.equal(w.mode,'driving');assert.equal(w.snapshot,null);
});
test('walking and running normalize diagonals, stop at obstacles and do not tunnel at long frame times',()=>{
 const create=()=>{const w=new WalkingController(p=>p.z < -2);w.exit(car);advance(w,.6);return w;};const walk=create(),run=create();
 advance(walk,.5,{forward:true,back:false,left:false,right:false,run:false});advance(run,.5,{forward:true,back:false,left:false,right:false,run:true});assert.ok(run.distance>walk.distance*2);advance(run,3,{forward:true,back:false,left:false,right:false,run:true});assert.ok(run.pose.z>=-2);assert.equal(run.pose.speed,0);
 const diagonal=new WalkingController(()=>false);diagonal.exit(car);advance(diagonal,.6);advance(diagonal,1,{forward:true,back:false,left:false,right:true,run:false});assert.ok(Math.abs(diagonal.distance-1.6)<.01);
 const blocked=new WalkingController(()=>true);assert.equal(blocked.exit(car),'blocked');assert.equal(blocked.mode,'driving');
});
test('optional walking saves retain parked-car/archived poses and wallet, reject malformed state and keep legacy saves readable',()=>{
 const p={...newProgress(),money:360,trips:3,phase:'dropoff' as const},ride={version:1 as const,mapId:'a'.repeat(64),x:20,z:30,heading:1,phase:'dropoff' as const};const foot={version:1 as const,mapId:ride.mapId,x:22,z:31,heading:0};
 const raw=serializeRouteProgress(p,{x:72,z:36,heading:0,phase:'pickup'},ride,ride,foot),parsed=JSON.parse(raw);assert.deepEqual(readFootSave(raw),foot);assert.deepEqual(parsed.exportRide,ride);assert.equal(parsed.money,360);assert.equal(parsed.phase,'pickup');assert.equal(parsed.x,72);
 assert.equal(readFootSave(serializeRouteProgress(p,null,ride,ride)),null);for(const onFoot of [{...foot,x:null},{...foot,mapId:'bad'},{...foot,z:999999},null])assert.equal(readFootSave(JSON.stringify({onFoot})),null);
});
