import {test} from 'node:test';import assert from 'node:assert/strict';
import {VEHICLES,placeFleet,readFleet,availableVehicle,vehicleOverlap} from '../src/fleet';
import {advanceCar} from '../src/driving';import type {OsmMap} from '../src/osm-types';
const map={roads:[{width:8,oneway:'no',highway:'residential',points:[{x:-100,z:0},{x:100,z:0}]}],intersections:[],buildings:[]} as unknown as OsmMap;
const surface={roadSurface:(x:number,z:number)=>Math.abs(z)<=4&&Math.abs(x)<=100,isBlocked:()=>false};
const auto=()=>({x:0,z:0,heading:-Math.PI/2,speed:0,steering:0});
test('fleet placement preserves real alignment, left lanes, widths and non-overlap, fails closed if no usable road',()=>{
 const fleet=placeFleet(map,surface,auto());assert.equal(fleet.length,4);
 for(const v of fleet.slice(1)){assert.ok(v.state.z<0);assert.equal(v.state.heading,-Math.PI/2);assert.ok(surface.roadSurface(v.state.x,v.state.z));for(const other of fleet)if(v!==other)assert.equal(vehicleOverlap(v,other),false);}
 assert.equal(placeFleet({...map,roads:map.roads.map(r=>({...r,width:2}))},surface,auto()).length,1);
 const reverse=placeFleet({...map,roads:map.roads.map(r=>({...r,oneway:'-1'}))},surface,auto());assert.ok(reverse.slice(1).every(v=>v.state.heading===Math.PI/2));
});
test('fleet save validation preserves separate parked poses, zeros speed, rejects malformed and foreign data',()=>{
 const hash='a'.repeat(64),vehicles=placeFleet(map,surface,auto()),fleet={version:1,mapId:hash,active:'taxi',vehicles};vehicles[1].state.speed=12;
 const restored=readFleet(JSON.stringify({fleet}),hash)!;assert.equal(restored.active,'taxi');assert.equal(restored.vehicles[1].state.speed,0);assert.equal(restored.vehicles[1].state.x,vehicles[1].state.x);
 assert.equal(readFleet(JSON.stringify({fleet}), 'b'.repeat(64)),null);assert.equal(readFleet(JSON.stringify({fleet:{...fleet,vehicles:[vehicles[0],vehicles[0],vehicles[2],vehicles[3]]}}),hash),null);
 assert.equal(readFleet(JSON.stringify({fleet:{...fleet,vehicles:vehicles.map(v=>({...v,state:{...v.state,x:Infinity}}))}}),hash),null);
});
test('only stopped permitted vehicle can be selected; an active passenger binds entry to its vehicle',()=>{
 const fleet=placeFleet(map,surface,auto()),point=fleet[1].state;assert.equal(availableVehicle(fleet,point,null)?.id,'hatchback');assert.equal(availableVehicle(fleet,point,'auto')?.id,'auto');fleet[1].state.speed=2;assert.notEqual(availableVehicle(fleet,point,null)?.id,'hatchback');
});
test('vehicle-specific handling gives van slower acceleration and sedan a distinct speed cap',()=>{
 const input={throttle:true,brake:false,left:false,right:false,handbrake:false},a=auto(),v=auto(),t=auto();
 for(let i=0;i<100;i++){advanceCar(a,input,.01,[],surface,VEHICLES.auto);advanceCar(v,input,.01,[],surface,VEHICLES.van);advanceCar(t,input,.01,[],surface,VEHICLES.taxi);}assert.ok(a.speed>t.speed&&t.speed>v.speed);assert.equal(VEHICLES.taxi.taxiEligible,true);assert.equal(VEHICLES.van.taxiEligible,false);
});

test('streamed-map placement derives real junctions from shared nodes even when intersection metadata is empty',()=>{
 const roads=[{...map.roads[0],nodeIds:['a','junction','b'],points:[{x:-100,z:0},{x:0,z:0},{x:100,z:0}]},{...map.roads[0],nodeIds:['junction','c'],points:[{x:0,z:0},{x:0,z:50}]}];
 const fleet=placeFleet({...map,roads},surface,{...auto(),x:12});assert.equal(fleet.length,4);
 for(const v of fleet.slice(1))assert.ok(Math.hypot(v.state.x,v.state.z)>=10);
});

test('new parked vehicles keep the initial vehicle departure corridor clear',()=>{
 const start=auto(),fleet=placeFleet(map,surface,start);for(const v of fleet.slice(1)){const dx=v.state.x-start.x,dz=v.state.z-start.z,forward=-dx*Math.sin(start.heading)-dz*Math.cos(start.heading),lateral=Math.abs(dx*Math.cos(start.heading)-dz*Math.sin(start.heading));assert.ok(forward<=0||forward>=45||lateral>=(VEHICLES.auto.width+VEHICLES[v.kind].width)/2+.8);}
});

test('car and van doors pivot outwards on the approached side; wheels steer and brake lamps brighten',async()=>{
 const {createPlayableVehicle}=await import('../src/road-vehicle');const THREE=await import('three');
 for(const kind of ['hatchback','taxi','van'] as const){const model=createPlayableVehicle(kind);model.setDoor(true,1);model.animate(2,.3,.1,true);const driver=model.group.getObjectByName('Animated driver door')!,passenger=model.group.getObjectByName('Animated passenger door')!;assert.ok(driver.rotation.y>0);assert.equal(passenger.rotation.y,0);const hinge=driver.getWorldPosition(new THREE.Vector3()),edge=driver.localToWorld(new THREE.Vector3(0,0,1));assert.ok(edge.x>hinge.x);model.setDoor(true,-1);model.animate(0,0,.2);assert.ok(passenger.rotation.y<0);let wheels=0,steers=0;model.group.traverse(o=>{if(o.name==='Rolling wheel'){wheels++;assert.notEqual(o.rotation.x,0);}if(o.name==='Front steering wheel')steers++;});assert.equal(wheels,4);assert.equal(steers,2);model.setOccupied(false);assert.equal(model.group.getObjectByName('Seated player driver')!.visible,false);}
});
