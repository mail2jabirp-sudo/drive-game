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
