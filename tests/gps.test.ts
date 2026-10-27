import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoadNavigator,turnGuidance} from '../src/gps';
import {signalCountdown,signalPhase} from '../src/traffic-types';
import type {OsmRoad} from '../src/osm-types';
const road=(id:string,ids:string[],points:Array<[number,number]>,oneway:OsmRoad['oneway']='no'):OsmRoad=>({id,sourceWayId:id,nodeIds:ids,points:points.map(([x,z])=>({x,z})),oneway,width:7,name:id,highway:'secondary',maxspeed:40,layer:0,bridge:false,widthSource:'tag',tags:{}});
test('GPS follows exact connected source nodes and source one-way directions including same-segment endpoints',()=>{
 const nav=new RoadNavigator();nav.setRoads([road('east',['a','b','c'],[[0,0],[100,0],[100,-100]],'yes')]);
 const forward=nav.route({x:20,z:0},{x:100,z:-70});assert.equal(forward.available,true);assert.equal(forward.distance,150);assert.deepEqual(forward.points,[{x:20,z:0},{x:100,z:0},{x:100,z:-70}]);
 assert.equal(turnGuidance(forward,{x:20,z:0}).arrow,'↰');assert.equal(turnGuidance(forward,{x:20,z:0}).distance,80);assert.equal(turnGuidance(forward,{x:20,z:0,heading:Math.PI/2}).text,'Make a safe U-turn');
 const direct=nav.route({x:20,z:0},{x:60,z:0});assert.equal(direct.distance,40);assert.equal(nav.route({x:60,z:0},{x:20,z:0}).available,false);
});
test('GPS reroutes across a connected junction and rejects close disconnected ways and absent target coverage',()=>{
 const nav=new RoadNavigator();const main=road('main',['a','b','c'],[[0,0],[100,0],[100,-100]]),branch=road('branch',['b','d'],[[100,0],[200,0]]);
 nav.setRoads([main,branch,road('overpass',['u','v'],[[0,5],[100,5]])]);
 const before=nav.route({x:20,z:0},{x:100,z:-80}),wrong=nav.route({x:160,z:0},{x:100,z:-80});assert.equal(before.distance,160);assert.equal(wrong.distance,140);assert.deepEqual(wrong.points[1],{x:100,z:0});assert.equal(turnGuidance(wrong,{x:160,z:0}).arrow,'↱');
 assert.equal(nav.route({x:30,z:5},{x:100,z:-80}).available,false);assert.equal(nav.route({x:20,z:0},{x:900,z:900}).available,false);
 assert.equal(nav.route({x:20,z:-30},{x:100,z:-80}).offRoad,true);
});
test('signal countdowns end at the actual shared AI/lamp phase transition for both orientations',()=>{
 for(const heading of [0,Math.PI/2])for(const time of [0,11.5,12,13.9,14,15.5,16,27.5,28,29.5,30,31.5,32,63.5]){
  const seconds=signalCountdown(time,heading),phase=signalPhase(time,heading);assert.ok(seconds>0&&seconds<=18);
  assert.notEqual(signalPhase(Math.floor(time)+seconds+1e-6,heading),phase);
 }
});
