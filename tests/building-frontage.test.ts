import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildBuildingFrontages,frontageBlocks} from '../src/building-frontage';
import {buildingConflictsWithRoad,buildRoadFoundation} from '../src/road-foundation';
import type {OsmMap} from '../src/osm-types';
const data={bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},roads:[{id:'r',sourceWayId:'r',highway:'residential',width:5,widthSource:'estimate',points:[{x:-80,z:-10},{x:80,z:-10}],nodeIds:['a','b'],tags:{}}],buildings:[{id:'25',kind:'house',height:7.5,heightSource:'estimate',points:[{x:0,z:0},{x:12,z:0},{x:12,z:9},{x:0,z:9}],tags:{}}],water:[],landmarks:[]} as unknown as OsmMap;
test('bounded procedural frontages preserve footprint, stop clearance and road connectivity',()=>{
 const before=JSON.stringify(data),parts=buildBuildingFrontages(data,{x:5,z:5});assert.ok(parts.length>0);assert.deepEqual(parts,buildBuildingFrontages(structuredClone(data),{x:5,z:5}));assert.equal(JSON.stringify(data),before);
 const roads=buildRoadFoundation(data).patches;
 for(const part of parts){assert.equal(part.source,'procedural');assert.ok(roads.every(r=>!buildingConflictsWithRoad(part,r)));assert.ok(!buildingConflictsWithRoad(data.buildings[0],{...part,roadIds:[],kind:'segment'}));}
 const wall=parts.find(p=>p.solid)!,center={x:wall.points.reduce((n,p)=>n+p.x,0)/4,z:wall.points.reduce((n,p)=>n+p.z,0)/4};assert.ok(frontageBlocks(parts,center,.3));
 const entry=parts.find(p=>p.kind==='entrance')!,gate={x:entry.points.reduce((n,p)=>n+p.x,0)/4,z:entry.points.reduce((n,p)=>n+p.z,0)/4};assert.ok(!frontageBlocks(parts,gate,.35));
 assert.equal(buildBuildingFrontages(data,{x:5,z:5},[gate]).length,0);
 assert.equal(buildBuildingFrontages({...data,buildings:[{...data.buildings[0],renderExcludedReason:'source-road-buffer-overlap'}]},{x:5,z:5}).length,0);
 assert.equal(buildBuildingFrontages(data,{x:500,z:500}).length,0);
});
test('frontage excludes water, nearby footprints and carriageway shoulders rather than shifting geography',()=>{
 const parts=buildBuildingFrontages(data,{x:5,z:5}),entry=parts.find(p=>p.kind==='entrance')!;
 assert.equal(buildBuildingFrontages({...data,water:[{id:'pond',kind:'area',name:'',points:entry.points}]},{x:5,z:5}).length,0);
 const crossing={...data,roads:[{...data.roads[0],points:[{x:-80,z:-1},{x:80,z:-1}]}]};assert.equal(buildBuildingFrontages(crossing,{x:5,z:5}).length,0);
});
