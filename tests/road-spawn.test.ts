import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roadSpawn} from '../src/road-spawn';
import type {OsmMap} from '../src/osm-types';
const data={roads:[{width:7,oneway:'no',points:[{x:-100,z:0},{x:100,z:0}]}],buildings:[]} as unknown as OsmMap;
const surface={roadSurface:(x:number,z:number)=>Math.abs(z)<=3.5&&Math.abs(x)<=100,isBlocked:()=>false};
test('repair grass and crosswise edge saves onto source pavement while retaining valid poses exactly',()=>{
 const safe={x:0,z:-1,heading:-Math.PI/2};assert.deepEqual(roadSpawn(data,surface,safe),safe);
 for(const invalid of [{x:10,z:40,heading:0},{x:0,z:3,heading:0},{x:500,z:800,heading:0}]){
  const p=roadSpawn(data,surface,invalid);assert.equal(p.heading,-Math.PI/2);assert.ok(Math.abs(p.z)<2);assert.ok(Math.abs(p.x)<=98);
 }
});
test('recovery respects source reverse one-way heading and footprint obstacles',()=>{
 const reverse={...data,roads:data.roads.map(r=>({...r,oneway:'-1' as const}))};assert.equal(roadSpawn(reverse,surface,{x:0,z:10,heading:0}).heading,Math.PI/2);
 const blocked={...data,buildings:[{points:[{x:-5,z:-4},{x:5,z:-4},{x:5,z:4},{x:-5,z:4}]}]} as OsmMap;
 const recovered=roadSpawn(blocked,surface,{x:0,z:0,heading:0});assert.ok(Math.abs(recovered.x)>6.5);
 assert.throws(()=>roadSpawn(data,{...surface,isBlocked:()=>true},{x:0,z:0,heading:0}),/No safe/);
});
